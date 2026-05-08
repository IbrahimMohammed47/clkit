# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Run the CLI wizard
npm run dev        # Run with --watch for live reload during development
node bin/clkit.js  # Run directly
```

No build step, linter, or test suite is configured.

## Architecture

`clkit` is a Node.js ESM interactive CLI that scaffolds Claude/Agent configuration into a target project (wherever you `cd` before running it). It runs as a persistent menu loop.

```
bin/clkit.js   ← entry point; calls main() and handles Ctrl-C
src/index.js             ← renders banner, runs first-time setup, drives the feature selection loop
src/features/            ← one file per wizard (skills, plugins, mcp, hook-groups, misc)
src/utils/               ← stateless helpers; no cross-dependencies between utils files
src/data/                ← static data files (hook group definitions)
```

**First-time setup (`runSetup` in `src/index.js`):** Runs once per project. Initializes `.claude/` structure, adds deny rules for `.env`, and prompts for project type (coding vs agentic). Sets `ENABLE_CLAUDEAI_MCP_SERVERS` env var in `settings.json`; skips on subsequent runs if key already present.

**Feature flow pattern:** each `src/features/*.js` exports a single `<name>Wizard()` async function. The wizard renders a header, calls util functions to read current state, prompts the user via `@inquirer/prompts` (or `@inquirer/core` for custom prompts), diffs old vs. new selection, and applies changes. All prompts catch `ExitPromptError` (Ctrl-C) and return gracefully. The `misc` wizard is an exception: it presents one-shot enhancements via `checkbox` (no prior state to diff) and applies each selected option immediately.

**Tabbed prompts (`mcp.js`, `skills.js`):** built with `createPrompt` from `@inquirer/core`. Use `useState`/`useKeypress` directly. Important: `@inquirer/core`'s `useState` setter takes a plain value only — functional updaters (arrow functions) are not supported and will set state to the function itself. Always pass computed values using closure variables (e.g. `setActiveTab((activeTab + 1) % 2)`, not `setActiveTab(t => t + 1)`).

**Utils layer:**

| File            | Responsibility                                                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fs.js`         | Scans `~/.claude/skills`, `~/.agents/skills`, `~/.gemini/skills`, `~/.cursor/skills` for global skills; copies/removes skill folders to `./.claude/skills/`                                                  |
| `settings.js`   | Reads/writes `./.claude/settings.json` (`enabledPlugins`, `hooks`, `env`, `permissions.deny`, `disabledMcpjsonServers`) and `./.claude/settings.local.json` (`skillOverrides`); merges without clobbering keys owned by other users |
| `claude-cli.js` | Shells out to the `claude` CLI (`spawnSync`) for plugin listing/enable/disable and MCP listing/get; parses plain-text output                                                                                 |
| `mcp.js`        | Reads/writes `./.claude/.mcp.json` (`{ mcpServers: {...} }`); builds server config objects from wizard answers; extracts `${VAR}` references                                                                 |
| `hooks.js`      | Reads `src/data/hook-groups.json`; checks which predefined groups are fully applied; writes/removes hook entries in `settings.json` while preserving user-added hooks; checks precondition tools via `which` |

**State written to the target project's `.claude/` directory:**

- `.claude/skills/<name>/` — real-copy skill folders (Skills wizard, Copy to Project tab); symlinks dereferenced via `fs.realpathSync` + `fs.cpSync({ dereference: true })`
- `.claude/settings.json` — `enabledPlugins` map (Plugins wizard); `hooks` block (Hook Groups wizard); `env` and `permissions.deny` (first-time setup); `disabledMcpjsonServers` (MCP wizard)
- `.claude/settings.local.json` — `skillOverrides` map (Skills wizard, Enable/Disable tab); personal per-developer file, should not be committed
- `.claude/.mcp.json` — MCP server configs (MCP wizard)

**State written outside `.claude/` (Misc wizard):**

- `CLAUDE.md` — one-shot enhancements appended at the end (e.g. Karpathy guidelines). The file is created if it does not exist.

## Adding a new feature

1. Create `src/features/<feature>.js` exporting `async function <feature>Wizard()`.
2. Add any new shared logic to a new or existing file in `src/utils/`.
3. Register the feature in `src/index.js`: add a `choices` entry in the `select` prompt and a dispatch branch in the `if/else` block.

## Behavioral Coding Guidelines
Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
