import path from 'path';
import fs from 'fs';

export function getMcpFilePath(cwd = process.cwd()) {
  return path.join(cwd, '.claude', '.mcp.json');
}

export function readMcpConfig(cwd = process.cwd()) {
  try {
    return JSON.parse(fs.readFileSync(getMcpFilePath(cwd), 'utf8'));
  } catch {
    return { mcpServers: {} };
  }
}

export function writeMcpConfig(config, cwd = process.cwd()) {
  const filePath = getMcpFilePath(cwd);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

/**
 * Extracts all ${VAR_NAME} or ${VAR:-default} patterns from an object (deep scan).
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
