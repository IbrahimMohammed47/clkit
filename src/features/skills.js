import pc from "picocolors";
import {
  readSkillOverrides,
  writeSkillOverrides,
  getProjectLocalSettingsPath,
} from "../utils/settings.js";
import { renderWizardHeader } from "../utils/ui.js";
import { createTabbedPrompt } from "../utils/tabbed-prompt.js";
import { collectAllSkills, copySkillToProject, getLocalSkillsDir } from "../utils/fs.js";

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
    for (const name of selectedCopy) {
      const skill = copyable.find((s) => s.name === name);
      copySkillToProject(skill);
    }

    console.log(
      pc.green(
        pc.bold(`  ✔ Copied ${selectedCopy.length} skill(s) to project:`),
      ),
    );
    selectedCopy.forEach((s) => console.log(pc.green(`    + ${s}`)));
    console.log(
      pc.dim(`  Location: ${pc.underline(getLocalSkillsDir())}`),
    );
    console.log("");
  }
}
