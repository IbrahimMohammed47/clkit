import os from 'os';
import path from 'path';
import fs from 'fs';
import { readJson, writeJson } from './json.js';

const USER_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

export function getProjectSettingsPath(cwd = process.cwd()) {
  return path.join(cwd, '.claude', 'settings.json');
}

export function getUserInstalledPlugins() {
  const settings = readJson(USER_SETTINGS_PATH);
  return Object.keys(settings.enabledPlugins ?? {});
}

export function getProjectPlugins(cwd = process.cwd()) {
  const settings = readJson(getProjectSettingsPath(cwd));
  return settings.enabledPlugins ?? {};
}

export function mergeProjectPlugins(userPluginUpdates, cwd = process.cwd()) {
  const settingsPath = getProjectSettingsPath(cwd);
  const existing = readJson(settingsPath);
  const mergedPlugins = { ...(existing.enabledPlugins ?? {}), ...userPluginUpdates };
  writeJson(settingsPath, { ...existing, enabledPlugins: mergedPlugins });
}

export function initProjectStructure(cwd = process.cwd()) {
  const claudeDir = path.join(cwd, '.claude');
  const settingsPath = path.join(claudeDir, 'settings.json');

  fs.mkdirSync(claudeDir, { recursive: true });
  fs.mkdirSync(path.join(claudeDir, 'skills'), { recursive: true });

  if (!fs.existsSync(settingsPath)) {
    writeJson(settingsPath, {});
  }
}

export function hasProjectEnvVar(key, cwd = process.cwd()) {
  const settings = readJson(getProjectSettingsPath(cwd));
  return Object.prototype.hasOwnProperty.call(settings.env ?? {}, key);
}

export function ensureProjectEnvVar(key, value, cwd = process.cwd()) {
  const settingsPath = getProjectSettingsPath(cwd);
  const existing = readJson(settingsPath);
  const env = existing.env ?? {};
  if (env[key] === value) return;
  writeJson(settingsPath, { ...existing, env: { ...env, [key]: value } });
}

export function ensurePermissionDenyRule(rule, cwd = process.cwd()) {
  const settingsPath = getProjectSettingsPath(cwd);
  const existing = readJson(settingsPath);
  const permissions = existing.permissions ?? {};
  const deny = permissions.deny ?? [];
  if (deny.includes(rule)) return;
  writeJson(settingsPath, {
    ...existing,
    permissions: { ...permissions, deny: [...deny, rule] },
  });
}

export function getDisabledMcpServers(cwd = process.cwd()) {
  const settings = readJson(getProjectSettingsPath(cwd));
  return settings.disabledMcpjsonServers ?? [];
}

export function setDisabledMcpServers(names, cwd = process.cwd()) {
  const settingsPath = getProjectSettingsPath(cwd);
  const existing = readJson(settingsPath);
  const updated = { ...existing };
  if (names.length === 0) {
    delete updated.disabledMcpjsonServers;
  } else {
    updated.disabledMcpjsonServers = names;
  }
  writeJson(settingsPath, updated);
}

export function getProjectLocalSettingsPath(cwd = process.cwd()) {
  return path.join(cwd, '.claude', 'settings.local.json');
}

export function readSkillOverrides(cwd = process.cwd()) {
  const settings = readJson(getProjectLocalSettingsPath(cwd));
  return settings.skillOverrides ?? {};
}

export function writeSkillOverrides(overrides, cwd = process.cwd()) {
  const filePath = getProjectLocalSettingsPath(cwd);
  const existing = readJson(filePath);
  writeJson(filePath, { ...existing, skillOverrides: overrides });
}
