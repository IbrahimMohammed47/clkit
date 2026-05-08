import os from 'os';
import path from 'path';
import fs from 'fs';

const USER_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

/**
 * Reads and parses a JSON file. Returns {} if the file doesn't exist or is invalid.
 * @param {string} filePath
 * @returns {object}
 */
function readJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Writes an object as formatted JSON to a file, creating parent dirs as needed.
 * @param {string} filePath
 * @param {object} data
 */
function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * Returns the path to the project-level settings.json.
 * @returns {string}
 */
export function getProjectSettingsPath() {
  return path.join(process.cwd(), '.claude', 'settings.json');
}

/**
 * Returns all plugin IDs installed at the user level (keys of enabledPlugins
 * in ~/.claude/settings.json).
 * @returns {string[]}
 */
export function getUserInstalledPlugins() {
  const settings = readJson(USER_SETTINGS_PATH);
  const plugins = settings.enabledPlugins ?? {};
  return Object.keys(plugins);
}

/**
 * Reads the current project-level settings.json and returns the enabledPlugins map.
 * @returns {Record<string, boolean>}
 */
export function getProjectPlugins() {
  const settings = readJson(getProjectSettingsPath());
  return settings.enabledPlugins ?? {};
}

/**
 * Merges the given plugin enable/disable map into the project settings,
 * touching ONLY the keys present in `userPluginUpdates`.
 * Plugin keys added by other team members (not in the current user's
 * installed set) are preserved as-is.
 *
 * @param {Record<string, boolean>} userPluginUpdates  — only the current user's installed plugins
 */
export function mergeProjectPlugins(userPluginUpdates) {
  const settingsPath = getProjectSettingsPath();
  const existing = readJson(settingsPath);
  const existingPlugins = existing.enabledPlugins ?? {};

  // Merge: existing project plugin states, overridden only for keys the current user owns
  const mergedPlugins = { ...existingPlugins, ...userPluginUpdates };

  const updated = { ...existing, enabledPlugins: mergedPlugins };
  writeJson(settingsPath, updated);
}

/**
 * Creates .claude/, .claude/skills/, and .claude/settings.json in the current
 * working directory if any of them are missing.
 */
export function initProjectStructure() {
  const claudeDir = path.join(process.cwd(), '.claude');
  const skillsDir = path.join(claudeDir, 'skills');
  const settingsPath = path.join(claudeDir, 'settings.json');

  fs.mkdirSync(claudeDir, { recursive: true });
  fs.mkdirSync(skillsDir, { recursive: true });

  if (!fs.existsSync(settingsPath)) {
    writeJson(settingsPath, {});
  }
}

/**
 * Returns true if the given key exists (even as false/null) in the project
 * settings.json `env` block.
 * @param {string} key
 * @returns {boolean}
 */
export function hasProjectEnvVar(key) {
  const settings = readJson(getProjectSettingsPath());
  return Object.prototype.hasOwnProperty.call(settings.env ?? {}, key);
}

/**
 * Ensures a key/value pair exists in the project settings.json `env` block.
 * Only writes if the key is missing or has the wrong value.
 * @param {string} key
 * @param {string} value
 */
export function ensureProjectEnvVar(key, value) {
  const settingsPath = getProjectSettingsPath();
  const existing = readJson(settingsPath);
  const env = existing.env ?? {};
  if (env[key] === value) return;
  const updated = { ...existing, env: { ...env, [key]: value } };
  writeJson(settingsPath, updated);
}

/**
 * Ensures a deny rule exists in the project settings.json `permissions.deny` array.
 * No-ops if the rule is already present.
 * @param {string} rule
 */
export function ensurePermissionDenyRule(rule) {
  const settingsPath = getProjectSettingsPath();
  const existing = readJson(settingsPath);
  const permissions = existing.permissions ?? {};
  const deny = permissions.deny ?? [];
  if (deny.includes(rule)) return;
  const updated = {
    ...existing,
    permissions: { ...permissions, deny: [...deny, rule] },
  };
  writeJson(settingsPath, updated);
}

/**
 * Returns the list of server names currently in `disabledMcpjsonServers`
 * in the project settings.json.
 * @returns {string[]}
 */
export function getDisabledMcpServers() {
  const settings = readJson(getProjectSettingsPath());
  return settings.disabledMcpjsonServers ?? [];
}

/**
 * Writes the `disabledMcpjsonServers` array to project settings.json.
 * Clears the key entirely if the list is empty.
 * @param {string[]} names
 */
export function setDisabledMcpServers(names) {
  const settingsPath = getProjectSettingsPath();
  const existing = readJson(settingsPath);
  const updated = { ...existing };
  if (names.length === 0) {
    delete updated.disabledMcpjsonServers;
  } else {
    updated.disabledMcpjsonServers = names;
  }
  writeJson(settingsPath, updated);
}

/**
 * Returns the path to the project-level settings.local.json.
 * @returns {string}
 */
export function getProjectLocalSettingsPath() {
  return path.join(process.cwd(), '.claude', 'settings.local.json');
}

/**
 * Reads skillOverrides from .claude/settings.local.json.
 * Returns {} if file doesn't exist or key is absent.
 * @returns {Record<string, boolean>}
 */
export function readSkillOverrides() {
  const settings = readJson(getProjectLocalSettingsPath());
  return settings.skillOverrides ?? {};
}

/**
 * Merges skillOverrides into .claude/settings.local.json without clobbering other keys.
 * Creates the file if it doesn't exist.
 * @param {Record<string, boolean>} overrides
 */
export function writeSkillOverrides(overrides) {
  const filePath = getProjectLocalSettingsPath();
  const existing = readJson(filePath);
  const updated = { ...existing, skillOverrides: overrides };
  writeJson(filePath, updated);
}

/**
 * Syncs skill permissions in settings.json to deny all global skills except selected.
 * - Adds Skill(name) deny rules for all unselected global skills
 * - Preserves non-Skill() deny rules (e.g., "Read(./.env)")
 * - Returns array of denied skill names (for warning)
 * @param {string[]} selectedSkillNames — skill names currently selected in this project
 * @param {string[]} availableSkillNames — all available global skill names
 * @returns {string[]} — names of skills that were denied
 */
export function syncSkillPermissions(selectedSkillNames, availableSkillNames) {
  const settingsPath = getProjectSettingsPath();
  const existing = readJson(settingsPath);
  const permissions = existing.permissions ?? {};
  const deny = permissions.deny ?? [];

  const selectedSet = new Set(selectedSkillNames);
  const availableSet = new Set(availableSkillNames);

  // Remove old skill deny rules; keep non-skill deny rules
  const newDeny = deny.filter((rule) => {
    if (!rule.startsWith('Skill(') || !rule.endsWith(')')) {
      return true; // Keep non-skill rules
    }
    return false; // Remove all existing Skill() deny rules to rebuild
  });

  // Add deny rules for unselected skills
  for (const skillName of availableSkillNames) {
    if (!selectedSet.has(skillName)) {
      newDeny.push(`Skill(${skillName})`);
    }
  }

  // Sort for consistent diffs
  newDeny.sort();

  // Write only if changed
  if (JSON.stringify(newDeny) !== JSON.stringify(deny)) {
    const updated = {
      ...existing,
      permissions: { ...permissions, deny: newDeny },
    };
    writeJson(settingsPath, updated);
  }

  // Return denied skills (all available - selected)
  const deniedSkills = [...availableSet].filter((s) => !selectedSet.has(s));
  return deniedSkills;
}
