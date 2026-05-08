import {
  createPrompt,
  useState,
  useKeypress,
  isEnterKey,
  isSpaceKey,
  isUpKey,
  isDownKey,
} from "@inquirer/core";
import pc from "picocolors";
import os from "os";
import path from "path";
import fs from "fs";
import {
  readSkillOverrides,
  writeSkillOverrides,
  getProjectLocalSettingsPath,
} from "../utils/settings.js";

function listSkillFolders(dirPath) {
  try {
    return fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((e) => {
        if (e.isDirectory()) return true;
        if (e.isSymbolicLink()) {
          try {
            return fs.statSync(path.join(dirPath, e.name)).isDirectory();
          } catch {
            return false;
          }
        }
        return false;
      })
      .map((e) => e.name);
  } catch {
    return [];
  }
}

function collectAllSkills() {
  const userSkillsDir = path.join(os.homedir(), ".claude", "skills");
  const projectSkillsDir = path.join(process.cwd(), ".claude", "skills");

  const skillMap = new Map();

  for (const name of listSkillFolders(userSkillsDir)) {
    skillMap.set(name, {
      name,
      sources: ["user"],
      userSourcePath: path.join(userSkillsDir, name),
    });
  }
  for (const name of listSkillFolders(projectSkillsDir)) {
    if (skillMap.has(name)) {
      skillMap.get(name).sources.push("project");
    } else {
      skillMap.set(name, { name, sources: ["project"] });
    }
  }

  return [...skillMap.values()].sort((a, b) => a.name.localeCompare(b.name));
}

const TAB_DESCRIPTIONS = [
  "Toggle skills on/off for this project. Saved to settings.local.json — personal, not committed.",
  "Copy skills from ~/.claude/skills/ into .claude/skills/ to share with teammates via git.",
];

const tabbedSkillsPrompt = createPrompt((config, done) => {
  const { tabs } = config; // [{ label, choices: [{name, value, checked, tag?}] }]

  const [activeTab, setActiveTab] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [sel0, setSel0] = useState(
    new Set(tabs[0].choices.filter((c) => c.checked).map((c) => c.value)),
  );
  const [sel1, setSel1] = useState(
    new Set(tabs[1].choices.filter((c) => c.checked).map((c) => c.value)),
  );

  useKeypress((key) => {
    const choices = tabs[activeTab].choices;

    if (isEnterKey(key)) {
      done([
        tabs[0].choices.filter((c) => sel0.has(c.value)).map((c) => c.value),
        tabs[1].choices.filter((c) => sel1.has(c.value)).map((c) => c.value),
      ]);
    } else if (key.name === "left") {
      setActiveTab((activeTab - 1 + 2) % 2);
      setCursor(0);
    } else if (key.name === "right") {
      setActiveTab((activeTab + 1) % 2);
      setCursor(0);
    } else if (isUpKey(key) && choices.length > 0) {
      setCursor((cursor - 1 + choices.length) % choices.length);
    } else if (isDownKey(key) && choices.length > 0) {
      setCursor((cursor + 1) % choices.length);
    } else if (isSpaceKey(key) && choices.length > 0) {
      const val = choices[cursor]?.value;
      if (!val) return;
      if (activeTab === 0) {
        const next = new Set(sel0);
        if (next.has(val)) next.delete(val);
        else next.add(val);
        setSel0(next);
      } else {
        const next = new Set(sel1);
        if (next.has(val)) next.delete(val);
        else next.add(val);
        setSel1(next);
      }
    }
  });

  const currentChoices = tabs[activeTab].choices;
  const currentSel = activeTab === 0 ? sel0 : sel1;

  const tabBar = tabs
    .map((t, i) =>
      i === activeTab
        ? pc.bgCyan(pc.black(pc.bold(` ${t.label} `)))
        : pc.dim(` ${t.label} `),
    )
    .join(pc.dim("│"));

  const description = pc.dim(`  ${TAB_DESCRIPTIONS[activeTab]}`);

  const items =
    currentChoices.length === 0
      ? pc.dim("    (none)")
      : currentChoices
          .map((choice, i) => {
            const atCursor = i === cursor;
            const selected = currentSel.has(choice.value);
            const box = selected ? pc.green("◉") : pc.dim("◯");
            const label = selected
              ? pc.green(choice.name)
              : atCursor
                ? pc.cyan(choice.name)
                : choice.name;
            const pointer = atCursor ? pc.cyan("›") : " ";
            const tag = choice.tag ? `  ${pc.dim(choice.tag)}` : "";
            return `  ${pointer} ${box}  ${label}${tag}`;
          })
          .join("\n");

  const hint = pc.dim("  ◄ ► tabs   ↑↓ move   Space toggle   Enter confirm");

  return `\n  ${tabBar}\n${description}\n\n${items}\n\n${hint}\n`;
});

function renderHeader() {
  console.log("");
  console.log(pc.bgCyan(pc.black(pc.bold("  ✦ clkit › Skills  "))));
  console.log("");
}

export async function skillsWizard() {
  renderHeader();

  const skills = collectAllSkills();
  const overrides = readSkillOverrides();

  const toggleChoices = skills.map(({ name, sources }) => {
    const tag =
      sources.includes("user") && sources.includes("project")
        ? "(user + project)"
        : sources.includes("project")
          ? "(project)"
          : "(user)";
    return {
      name,
      value: name,
      tag,
      checked: overrides[name] !== "off",
    };
  });

  const copyable = skills.filter(
    (s) => s.sources.includes("user") && !s.sources.includes("project"),
  );
  const copyChoices = copyable.map(({ name }) => ({
    name,
    value: name,
    checked: false,
  }));

  let result;
  try {
    result = await tabbedSkillsPrompt({
      tabs: [
        { label: "Enable / Disable", choices: toggleChoices },
        { label: "Copy to Project", choices: copyChoices },
      ],
    });
  } catch (err) {
    if (err.name === "ExitPromptError") return;
    throw err;
  }

  const [selectedEnabled, selectedCopy] = result;
  console.log("");

  // ── Apply toggle changes ──────────────────────────────────────────────────
  if (toggleChoices.length > 0) {
    const enabledSet = new Set(selectedEnabled);
    const newOverrides = {};
    for (const { name } of skills) {
      if (!enabledSet.has(name)) newOverrides[name] = "off";
    }

    writeSkillOverrides(newOverrides);

    const prevDisabled = new Set(
      Object.entries(overrides)
        .filter(([, v]) => v === "off")
        .map(([k]) => k),
    );
    const nowDisabled = new Set(Object.keys(newOverrides));
    const nowEnabled = [...prevDisabled].filter((n) => !nowDisabled.has(n));
    const newlyDisabled = [...nowDisabled].filter((n) => !prevDisabled.has(n));

    if (nowEnabled.length > 0) {
      console.log(
        pc.green(pc.bold(`  ✔ Re-enabled ${nowEnabled.length} skill(s):`)),
      );
      nowEnabled.forEach((s) => console.log(pc.green(`    + ${s}`)));
    }
    if (newlyDisabled.length > 0) {
      console.log(
        pc.red(pc.bold(`  ✖ Disabled ${newlyDisabled.length} skill(s):`)),
      );
      newlyDisabled.forEach((s) => console.log(pc.red(`    - ${s}`)));
    }
    if (nowEnabled.length === 0 && newlyDisabled.length === 0) {
      console.log(pc.dim("  ○ No changes to skill overrides."));
    }
    console.log(
      pc.dim(`  Overrides: ${pc.underline(getProjectLocalSettingsPath())}`),
    );
    console.log("");
  }

  // ── Apply copy changes ────────────────────────────────────────────────────
  if (selectedCopy.length > 0) {
    const projectSkillsDir = path.join(process.cwd(), ".claude", "skills");
    fs.mkdirSync(projectSkillsDir, { recursive: true });

    for (const name of selectedCopy) {
      const skill = copyable.find((s) => s.name === name);
      const realSrc = fs.realpathSync(skill.userSourcePath);
      fs.cpSync(realSrc, path.join(projectSkillsDir, name), {
        recursive: true,
        dereference: true,
      });
    }

    console.log(
      pc.green(
        pc.bold(`  ✔ Copied ${selectedCopy.length} skill(s) to project:`),
      ),
    );
    selectedCopy.forEach((s) => console.log(pc.green(`    + ${s}`)));
    console.log(
      pc.dim(
        `  Location: ${pc.underline(path.join(process.cwd(), ".claude", "skills"))}`,
      ),
    );
    console.log("");
  }
}
