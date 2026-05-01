import { spawnSync } from "child_process";

/**
 * Runs a `claude` CLI command and returns stdout, stderr, and exit status.
 * Uses shell:true for cross-platform compatibility (handles .cmd on Windows etc.)
 * @param {string[]} args
 * @returns {{ stdout: string; stderr: string; status: number }}
 */
function runClaude(args) {
  const result = spawnSync("claude", args, {
    encoding: "utf8",
    shell: true,
  });
  if (result.error) throw result.error;
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status ?? 1,
  };
}

/**
 * Parses the output of `claude plugins list` into a structured array.
 *
 * Expected format per plugin:
 *   ❯ caveman@caveman
 *     Version: 84cc3c14fa1e
 *     Scope: user
 *     Status: ✘ disabled
 *
 * @param {string} output
 * @returns {{ id: string; version: string; scope: string; enabled: boolean }[]}
 */
function parsePluginsList(output) {
  const plugins = [];
  let current = null;

  for (const raw of output.split("\n")) {
    const line = raw.trim();

    // New plugin entry — the ❯ marker (U+276F)
    const idMatch = line.match(/^❯\s+(.+)$/);
    if (idMatch) {
      if (current) plugins.push(current);
      current = {
        id: idMatch[1].trim(),
        version: "unknown",
        scope: "user",
        enabled: false,
      };
      continue;
    }

    if (!current) continue;

    const versionMatch = line.match(/^Version:\s+(.+)$/);
    if (versionMatch) {
      current.version = versionMatch[1].trim();
      continue;
    }

    const scopeMatch = line.match(/^Scope:\s+(.+)$/);
    if (scopeMatch) {
      current.scope = scopeMatch[1].trim();
      continue;
    }

    const statusMatch = line.match(/^Status:\s+(.+)$/);
    if (statusMatch) {
      const statusText = statusMatch[1].trim();
      // "✔ enabled" → true, "✘ disabled" → false
      current.enabled =
        statusText.includes("enabled") && !statusText.includes("disabled");
    }
  }

  if (current) plugins.push(current);
  return plugins;
}

/**
 * Returns all plugins known to the claude CLI (user + project scope).
 * Returns [] if the command fails or claude is not installed.
 * @returns {{ id: string; version: string; scope: string; enabled: boolean }[]}
 */
export function getInstalledPlugins() {
  try {
    const { stdout, status } = runClaude(["plugins", "list"]);
    if (status !== 0) return [];
    return parsePluginsList(stdout);
  } catch {
    return [];
  }
}

/**
 * Enables a plugin at project scope via the claude CLI.
 * Always uses --scope project so the change lands in ./.claude/settings.json
 * @param {string} id
 */
export function enablePlugin(id) {
  const { status, stderr } = runClaude([
    "plugins",
    "enable",
    "--scope",
    "project",
    id,
  ]);
  if (status !== 0) {
    throw new Error(stderr.trim() || `Failed to enable plugin: ${id}`);
  }
}

/**
 * Disables a plugin at project scope via the claude CLI.
 * Always uses --scope project so the change lands in ./.claude/settings.json
 * @param {string} id
 */
export function disablePlugin(id) {
  const { status, stderr } = runClaude([
    "plugins",
    "disable",
    "--scope",
    "project",
    id,
  ]);
  if (status !== 0) {
    throw new Error(stderr.trim() || `Failed to disable plugin: ${id}`);
  }
}

/**
 * Parses the output of `claude mcp list`.
 * Format: `<name>: <details> - <status>`
 * @param {string} output
 * @returns {string[]}
 */
function parseMcpList(output) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line || !line.includes(":")) return false;
      if (line.startsWith("Checking")) return false;
      if (line.startsWith("Installed")) return false;
      // Skip connectors
      if (line.startsWith("claude.ai")) return false;
      // Skip plugin-managed servers
      if (line.startsWith("plugin:")) return false;
      return true;
    })
    .map((line) => {
      // The name is everything before the FIRST colon
      const match = line.match(/^([^:]+):/);
      return match ? match[1].trim() : null;
    })
    .filter(Boolean);
}

/**
 * Lists all configured MCP server names via the CLI.
 * @returns {string[]}
 */
export function listMcpServers() {
  try {
    const { stdout, status } = runClaude(["mcp", "list"]);
    if (status !== 0) return [];
    return parseMcpList(stdout);
  } catch {
    return [];
  }
}

/**
 * Parses the output of `claude mcp get <name>`.
 * @param {string} output
 * @returns {object|null}
 */
function parseMcpDetails(output) {
  const lines = output.split("\n").map((l) => l.trim());
  const config = { env: {}, args: [] };
  let currentSection = null;

  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith("To remove this server")) break;

    if (line.startsWith("Type:")) {
      config.type = line.replace("Type:", "").trim().toLowerCase();
      continue;
    }
    if (line.startsWith("URL:")) {
      config.url = line.replace("URL:", "").trim();
      continue;
    }
    if (line.startsWith("Command:")) {
      config.command = line.replace("Command:", "").trim();
      continue;
    }
    if (line.startsWith("Args:")) {
      currentSection = "args";
      continue;
    }
    if (line.startsWith("Env:")) {
      currentSection = "env";
      continue;
    }
    if (line.startsWith("Headers:")) {
      currentSection = "headers";
      continue;
    }

    // Indented content or list items
    if (currentSection === "args") {
      config.args.push(line);
    } else if (currentSection === "env" || currentSection === "headers") {
      const firstColon = line.indexOf(":");
      if (firstColon !== -1) {
        const k = line.slice(0, firstColon).trim();
        const v = line.slice(firstColon + 1).trim();
        if (!config[currentSection]) config[currentSection] = {};
        config[currentSection][k] = v;
      }
    }
  }

  // Final structure cleanup
  const finalConfig = {};
  if (config.type === "stdio" || config.command) {
    finalConfig.command = config.command;
    if (config.args && config.args.length > 0) finalConfig.args = config.args;
  } else {
    if (config.type) finalConfig.type = config.type;
    if (config.url) finalConfig.url = config.url;
    if (config.headers && Object.keys(config.headers).length > 0)
      finalConfig.headers = config.headers;
  }

  if (config.env && Object.keys(config.env).length > 0) {
    finalConfig.env = config.env;
  }

  return finalConfig;
}

/**
 * Adds an MCP server at project scope via `claude mcp add --scope project`.
 * @param {{ name: string; transport: string; command?: string; args?: string[]; url?: string; env?: Record<string,string> }} opts
 */
export function addMcpServer({
  name,
  transport,
  command,
  args = [],
  url,
  env = {},
}) {
  const cliArgs = ["mcp", "add"];

  if (transport !== "stdio") {
    cliArgs.push("--transport", transport);
  }

  cliArgs.push(name);

  if (transport === "stdio") {
    cliArgs.push(command, ...args);
  } else {
    cliArgs.push(url);
  }

  cliArgs.push("--scope", "project");

  for (const [k, v] of Object.entries(env)) {
    cliArgs.push("-e", `${k}=${v}`);
  }

  const { status, stderr } = runClaude(cliArgs);
  if (status !== 0) {
    throw new Error(stderr.trim() || `Failed to add MCP server: ${name}`);
  }
}

/**
 * Gets the configuration for a specific MCP server via the CLI.
 * @param {string} name
 * @returns {object|null}
 */
export function getMcpServerDetails(name) {
  try {
    const { stdout, status } = runClaude(["mcp", "get", name]);
    if (status !== 0) return null;
    return parseMcpDetails(stdout);
  } catch {
    return null;
  }
}
