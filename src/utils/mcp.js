import path from 'path';
import fs from 'fs';

/**
 * Returns the path to the project-level .mcp.json file.
 * @returns {string}
 */
export function getMcpFilePath() {
  return path.join(process.cwd(), '.claude', '.mcp.json');
}

/**
 * Reads and parses the project .mcp.json file.
 * Returns { mcpServers: {} } if missing or invalid.
 * @returns {{ mcpServers: Record<string, object> }}
 */
export function readMcpConfig() {
  try {
    const raw = fs.readFileSync(getMcpFilePath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return { mcpServers: {} };
  }
}

/**
 * Writes the MCP config back to .claude/.mcp.json, creating dirs as needed.
 * @param {{ mcpServers: Record<string, object> }} config
 */
export function writeMcpConfig(config) {
  const filePath = getMcpFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

/**
 * Extracts all ${VAR_NAME} or ${VAR:-default} patterns from an object (deep scan).
 * Returns a list of unique variable names referenced.
 * @param {any} obj
 * @returns {string[]}
 */
export function extractEnvVarRefs(obj) {
  const found = new Set();
  const pattern = /\$\{([A-Z0-9_]+)(?::-[^}]*)?\}/g;

  function scan(value) {
    if (typeof value === 'string') {
      let m;
      while ((m = pattern.exec(value)) !== null) {
        found.add(m[1]);
      }
      pattern.lastIndex = 0;
    } else if (Array.isArray(value)) {
      value.forEach(scan);
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(scan);
    }
  }

  scan(obj);
  return Array.from(found);
}

/**
 * Builds a server config object from wizard answers.
 * @param {{ transport: string; command?: string; args?: string[]; url?: string; headers?: Record<string,string>; env?: Record<string,string> }} answers
 * @returns {object}
 */
export function buildServerConfig(answers) {
  const { transport, command, args = [], url, headers = {}, env = {} } = answers;

  if (transport === 'stdio') {
    return {
      command,
      ...(args.length > 0 ? { args } : {}),
      ...(Object.keys(env).length > 0 ? { env } : {}),
    };
  }

  return {
    type: transport,
    url,
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
    ...(Object.keys(env).length > 0 ? { env } : {}),
  };
}
