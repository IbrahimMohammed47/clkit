import pc from "picocolors";
import os from "os";
import path from "path";
import fs from "fs";
import {
  readSkillOverrides,
  writeSkillOverrides,
  getProjectLocalSettingsPath,
} from "../utils/settings.js";
import { renderWizardHeader } from "../utils/ui.js";
import { createTabbedPrompt } from "../utils/tabbed-prompt.js";

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

const tabbedSkillsPrompt = createTabbedPrompt({
  accentBg: pc.bgCyan,
  tabDescriptions: [
    "Toggle skills on/off for this project. Saved to settings.local.json — personal, not committed.",
    "Copy skills from ~/.claude/skills/ into .claude/skills/ to share with teammates via git.",
  ],
});


export async function skillsWizard() {
  renderWizardHeader('Skills', null, pc.bgCyan);

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
