import { select } from "@inquirer/prompts";
import pc from "picocolors";
import figlet from "figlet";
import { skillsWizard } from "./features/skills.js";
import { pluginsWizard } from "./features/plugins.js";
import { mcpWizard } from "./features/mcp.js";
import { hookGroupsWizard } from "./features/hook-groups.js";
import { miscWizard } from "./features/misc.js";
import {
  initProjectStructure,
  hasProjectEnvVar,
  ensureProjectEnvVar,
  ensurePermissionDenyRule,
} from "./utils/settings.js";

const VERSION = "1.0.0";

function renderBanner() {
  console.clear();
  console.log("");
  const art = figlet.textSync("clkit", { font: "ANSI Shadow" });
  console.log(pc.bold(pc.cyan(art)));
  console.log(
    pc.dim(`  Claude/Agent project wizard  `) + pc.white(`v${VERSION}`),
  );
  console.log("");
  console.log(pc.dim(`  Working directory: ${pc.underline(process.cwd())}`));
  console.log("");
}

async function runSetup() {
  initProjectStructure();
  ensurePermissionDenyRule("Read(./.env)");
  ensurePermissionDenyRule("Grep(./.env)");

  if (hasProjectEnvVar("ENABLE_CLAUDEAI_MCP_SERVERS")) return;

  console.log("");
  console.log(pc.bold(pc.cyan("  ◆  First-time project setup")));
  console.log("");

  let projectType;
  try {
    projectType = await select({
      message: "How will Claude be used in this project?",
      choices: [
        {
          name: `${pc.cyan("{ }")}  Coding project        ${pc.dim("Claude as a coding assistant")}`,
          value: "coding",
        },
        {
          name: `${pc.magenta("◈")}  Agentic workspace     ${pc.dim("Claude for autonomous / multi-step work")}`,
          value: "agentic",
        },
      ],
    });
  } catch (err) {
    if (err.name === "ExitPromptError") return;
    throw err;
  }

  ensureProjectEnvVar(
    "ENABLE_CLAUDEAI_MCP_SERVERS",
    projectType === "agentic" ? "true" : "false",
  );

  console.log("");
  console.log(pc.dim("  ─────────────────────────────────────"));
}

export async function main() {
  await runSetup();

  renderBanner();

  while (true) {
    const feature = await select({
      message: "What would you like to configure?",
      choices: [
        {
          name: `${pc.magenta("✦")}  Plugins       ${pc.dim("Enable/disable Claude plugins for this project")}`,
          value: "plugins",
        },
        {
          name: `${pc.cyan("✦")}  MCPs          ${pc.dim("Manage MCP servers for this project")}`,
          value: "mcps",
        },
        {
          name: `${pc.yellow("✦")}  Hooks         ${pc.dim("Enable predefined hook groups for this project")}`,
          value: "hooks",
        },
        {
          name: `${pc.white("✦")}  Misc          ${pc.dim("Miscellaneous project enhancements")}`,
          value: "misc",
        },
        {
          name: `${pc.green("✦")}  Skills        ${pc.dim("Enable/disable skills for this project")}`,
          value: "skills",
        },
        {
          name: `${pc.dim("○")}  Agents        ${pc.dim("(coming soon)")}`,
          value: "agents",
          disabled: "(coming soon)",
        },
        {
          name: `${pc.red("✕")}  Exit`,
          value: "exit",
        },
      ],
    });

    if (feature === "exit") {
      console.log(pc.dim("\n  Bye! 👋\n"));
      break;
    }

    if (feature === "skills") {
      await skillsWizard();
    } else if (feature === "plugins") {
      await pluginsWizard();
    } else if (feature === "mcps") {
      await mcpWizard();
    } else if (feature === "hooks") {
      await hookGroupsWizard();
    } else if (feature === "misc") {
      await miscWizard();
    }

    console.log("");
    console.log(pc.dim("  ─────────────────────────────────────"));
    console.log("");
  }
}
