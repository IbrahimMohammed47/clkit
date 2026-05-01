# clkit

```
 ██████╗██╗     ██╗  ██╗██╗████████╗
██╔════╝██║     ██║ ██╔╝██║╚══██╔══╝
██║     ██║     █████╔╝ ██║   ██║   
██║     ██║     ██╔═██╗ ██║   ██║   
╚██████╗███████╗██║  ██╗██║   ██║   
 ╚═════╝╚══════╝╚═╝  ╚═╝╚═╝   ╚═╝  
```

[![npm version](https://img.shields.io/npm/v/@ibrahim-mohammed-47/clkit)](https://www.npmjs.com/package/@ibrahim-mohammed-47/clkit)

A CLI wizard that scaffolds Claude Code configuration into a project so the whole team shares the same setup.

> **Not affiliated with Anthropic.** This is an independent community tool. Claude and Claude Code are products of Anthropic.

## The core idea

Claude Code reads project-level configuration from a `.claude/` directory at the root of your repository. When that directory is committed to source control, every developer who clones the repo gets the same Claude behavior automatically — the same skills, the same hooks, the same plugin state, the same MCP server configuration.

The problem is that building this configuration manually is tedious and error-prone. `clkit` is a menu-driven wizard that does it for you: it reads your existing machine-level Claude setup, lets you select what belongs at the project level, and writes everything to `.claude/` in a format Claude Code understands.

The bundled presets — hook groups, predefined MCP servers, and Misc enhancements — reflect my own opinions about tools and setups I've found genuinely useful. They are opinionated by design.

## Installation

```bash
npm install -g @ibrahim-mohammed-47/clkit
```

Or run without installing:

```bash
npx @ibrahim-mohammed-47/clkit
```

## Usage

Run from the root of the project you want to configure:

```bash
clkit
```

On first run it initializes the `.claude/` directory structure, adds a permission deny rule to prevent Claude from reading `.env` files, and asks whether the project is a coding assistant project or an agentic workspace (which controls whether Claude AI MCP servers are enabled).

After setup, the main menu loops until you exit, letting you configure each feature independently.

Commit `.claude/` to your repository when done.

---

## Features

### Skills

Skills are reusable instruction sets that extend what Claude Code knows how to do. Claude Code loads skills from `.claude/skills/<name>/` in the project directory.

The Skills wizard scans your machine for globally installed skills across all supported agent tool locations:

- `~/.claude/skills/`
- `~/.agents/skills/`
- `~/.gemini/skills/`
- `~/.cursor/skills/`

It shows you every skill already installed on your machine and lets you choose which ones belong in this project. Selecting a skill copies its folder into `.claude/skills/`. Deselecting one removes it.

> The wizard does not suggest, recommend, or bundle any skills of its own. It only surfaces what you have already installed. Once a skill folder is committed to the repository, teammates who pull the repo get that skill applied automatically by Claude Code — even if they have never installed it globally themselves.

### Plugins

Claude Code supports plugins that extend its capabilities at the user or project scope. Project-scope plugin state is recorded in `.claude/settings.json` under `enabledPlugins`.

The Plugins wizard calls the `claude` CLI to list every plugin installed on your machine and shows their current enabled/disabled state. You select which ones should be active for this project. The wizard then calls `claude plugins enable` or `claude plugins disable` for each change and writes the result to `.claude/settings.json`.

> The wizard does not suggest or bundle any plugins. It only shows what the `claude` CLI reports as installed on your machine. If a teammate opens the project and a plugin declared in `settings.json` is not installed on their machine, the wizard warns them clearly rather than silently failing.

### MCP Servers

MCP (Model Context Protocol) servers extend Claude Code with external tool integrations.

The MCP wizard presents two tabs, navigable with `◄` / `►`:

**Installed tab** — lists every MCP server configured on your machine via `claude mcp add`. Toggle which ones should be active for this project. Disabled server names are written to `disabledMcpjsonServers` in `.claude/settings.json`.

**Predefined tab** — lists a curated set of MCP servers bundled with `clkit`. Selecting one adds its full configuration to `.claude/.mcp.json` so teammates get it automatically without running `claude mcp add` themselves.

| Server    | What it does                                     |
| --------- | ------------------------------------------------ |
| `shadcn`  | Browse and install shadcn/ui components via MCP  |

Both tabs confirm on a single `Enter` press. Changes to installed servers and predefined servers are applied together.

> Add more entries to `src/data/mcps.json` under `mcpServers` to extend the predefined list.

### Hook Groups

Claude Code hooks are shell commands that run automatically at lifecycle events: after a file edit, after Claude stops, when Claude needs input, and others. They are defined in `.claude/settings.json` under `hooks`.

The Hook Groups wizard presents a curated set of predefined hook groups bundled with `clkit`. These groups come from the tool itself, not from your machine — they reflect my own opinions about hooks worth having on most projects. Current built-in groups:

| Group                   | What it does                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `tsc-on-edit`           | Runs `tsc --noEmit` after any TypeScript file is edited or written                         |
| `npm-lint-on-edit`      | Runs `npm run lint` after any file is edited or written                                    |
| `eslint-on-edit`        | Runs `eslint --fix` on the affected JS/TS file after each edit                             |
| `prettier-on-edit`      | Runs `prettier --write` on the affected file after each edit                               |
| `desktop-notifications` | Sends a desktop notification when Claude finishes working or needs input (macOS and Linux) |

Selecting a group writes its hook entries into `.claude/settings.json`. The wizard is careful to preserve any hooks you or your team have added manually. Deselecting a group removes only the entries that group owns.

For groups that require external tools (e.g. `npx`, `npm`), the wizard checks whether those tools are available on your machine and warns you if they are not — but still applies the hooks, since teammates who do have the tools will benefit.

### Misc

The Misc wizard is a collection of project enhancements. Each option shows its current applied state; selecting toggles it on, deselecting removes it.

Current options:

| Option                | What it does                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `karpathy-guidelines` | Appends [Andrej Karpathy's LLM coding guidelines](https://github.com/forrestchang/andrej-karpathy-skills) to `CLAUDE.md`. Creates the file if it doesn't exist. |

> Unlike the other wizards, Misc writes directly to `CLAUDE.md` in the project root rather than to `.claude/`. Commit `CLAUDE.md` to share the result with your team.

---

## What gets committed

After running the wizard, commit these paths:

```
.claude/
  settings.json     # plugins, hooks, env vars, permission rules, disabled MCP servers
  .mcp.json         # MCP server configs (if applicable)
  skills/           # copied skill folders
CLAUDE.md           # project instructions (if Misc enhancements were applied)
```

Teammates pull the repo and Claude Code picks up the configuration automatically. They can run `clkit` themselves to adjust their local selections (e.g. choose which of their own global skills to add), and commit the result.

---

## How it works

`clkit` is a Node.js ESM CLI with no build step. It uses `@inquirer/prompts` for interactive menus and shells out to the `claude` CLI for plugin and MCP introspection. All writes go to the current working directory — it never modifies your global Claude configuration.

```
bin/clkit.js        entry point
src/index.js             banner, first-time setup, main menu loop
src/features/            one wizard per feature (skills, plugins, mcp, hook-groups, misc)
src/utils/               stateless helpers (fs, settings, claude-cli, mcp, hooks)
src/data/                bundled presets: hook group definitions, predefined MCP servers
```

## Requirements

- Node.js 18+
- `claude` CLI installed and authenticated ([Claude Code](https://claude.ai/code))

## License

MIT
