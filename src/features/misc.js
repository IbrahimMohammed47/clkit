import { checkbox } from "@inquirer/prompts";
import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";
import pc from "picocolors";
import { renderWizardHeader } from "../utils/ui.js";

const KARPATHY_START = "<!-- karpathy-guidelines -->";
const KARPATHY_END = "<!-- /karpathy-guidelines -->";


const MISC_OPTIONS = [
  {
    name: "karpathy-guidelines",
    label: "Karpathy Guidelines",
    description: "Append Andrej Karpathy's LLM coding guidelines to CLAUDE.md",
    isApplied() {
      const claudeMd = join(process.cwd(), "CLAUDE.md");
      if (!existsSync(claudeMd)) return false;
      const content = readFileSync(claudeMd, "utf8");
      return content.includes(KARPATHY_START) || content.includes("## Behavioral Coding Guidelines");
    },
    apply() {
      const claudeMd = join(process.cwd(), "CLAUDE.md");
      if (!existsSync(claudeMd)) appendFileSync(claudeMd, "");
      const raw = execSync(
        "curl -fsSL https://raw.githubusercontent.com/forrestchang/andrej-karpathy-skills/main/CLAUDE.md",
        { encoding: "utf8" }
      );
      const content = raw.replace(/^#\s+CLAUDE\.md\s*\n?/, "## Behavioral Coding Guidelines\n");
      appendFileSync(claudeMd, `\n${KARPATHY_START}\n${content}\n${KARPATHY_END}\n`);
    },
    remove() {
      const claudeMd = join(process.cwd(), "CLAUDE.md");
      if (!existsSync(claudeMd)) return true;
      const content = readFileSync(claudeMd, "utf8");
      if (!content.includes(KARPATHY_START)) return false; // legacy install, no sentinels
      const updated = content.replace(
        /\n?<!-- karpathy-guidelines -->[\s\S]*?<!-- \/karpathy-guidelines -->\n?/g,
        ""
      );
      writeFileSync(claudeMd, updated, "utf8");
      return true;
    },
  },
];

export async function miscWizard() {
  renderWizardHeader('Misc Wizard', 'Miscellaneous project enhancements', pc.bgWhite);

  const currentState = Object.fromEntries(MISC_OPTIONS.map((opt) => [opt.name, opt.isApplied()]));

  let selected;
  try {
    selected = await checkbox({
      message: "Select enhancements to apply",
      choices: MISC_OPTIONS.map((opt) => ({
        name: `${pc.white(opt.label)}  ${pc.dim(opt.description)}`,
        value: opt.name,
        checked: currentState[opt.name],
      })),
      loop: false,
      instructions: pc.dim("  (Space to toggle, Enter to confirm)"),
    });
  } catch (err) {
    if (err.name === "ExitPromptError") return;
    throw err;
  }

  const toApply = selected.filter((name) => !currentState[name]);
  const toRemove = MISC_OPTIONS.filter((opt) => currentState[opt.name] && !selected.includes(opt.name));

  if (toApply.length === 0 && toRemove.length === 0) {
    console.log("");
    console.log(pc.dim("  ○ No changes made."));
    console.log("");
    return;
  }

  console.log("");

  for (const name of toApply) {
    const opt = MISC_OPTIONS.find((o) => o.name === name);
    try {
      opt.apply();
      console.log(pc.green(`  ✔ Applied: ${opt.label}`));
    } catch (err) {
      console.log(pc.red(`  ✖ Failed: ${opt.label} — ${err.message}`));
    }
  }

  for (const opt of toRemove) {
    try {
      const ok = opt.remove();
      if (!ok) {
        console.log(pc.yellow(`  ⚠ ${opt.label} — legacy install (no sentinels), remove manually from CLAUDE.md`));
      } else {
        console.log(pc.green(`  ✔ Removed: ${opt.label}`));
      }
    } catch (err) {
      console.log(pc.red(`  ✖ Failed to remove: ${opt.label} — ${err.message}`));
    }
  }

  console.log("");
}
