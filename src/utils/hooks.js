import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { getProjectSettingsPath } from './settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {Array} */
const HOOK_GROUPS = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/hook-groups.json'), 'utf8')
);

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/** All command strings across every predefined group (used as identity keys). */
function buildPredefinedCommandSet() {
  const commands = new Set();
  for (const group of HOOK_GROUPS) {
    for (const matcherArray of Object.values(group.hookGroup)) {
      for (const matcherObj of matcherArray) {
        for (const hook of matcherObj.hooks) {
          commands.add(hook.command);
        }
      }
    }
  }
  return commands;
}

/**
 * Returns all predefined hook group definitions.
 * @returns {Array}
 */
export function getHookGroups() {
  return HOOK_GROUPS;
}

/**
 * Checks which predefined groups are currently fully applied in settings.json.
 * A group is "enabled" only when ALL of its hook entries are present verbatim.
 * @returns {string[]} enabled group names
 */
export function getEnabledGroupNames() {
  const settings = readJson(getProjectSettingsPath());
  const currentHooks = settings.hooks ?? {};
  const enabled = [];

  for (const group of HOOK_GROUPS) {
    let allPresent = true;
    outer: for (const [event, matcherArray] of Object.entries(group.hookGroup)) {
      const currentMatchers = currentHooks[event] ?? [];
      for (const matcherObj of matcherArray) {
        const found = currentMatchers.find(m => m.matcher === matcherObj.matcher);
        if (!found) { allPresent = false; break outer; }
        for (const hook of matcherObj.hooks) {
          if (!found.hooks.some(h => h.command === hook.command)) {
            allPresent = false;
            break outer;
          }
        }
      }
    }
    if (allPresent) enabled.push(group.name);
  }

  return enabled;
}

/**
 * Writes selected groups into settings.json hooks, leaving non-predefined hooks untouched.
 * Removes predefined hooks that are no longer selected.
 * @param {string[]} selectedGroupNames
 */
export function applyHookGroups(selectedGroupNames) {
  const settingsPath = getProjectSettingsPath();
  const settings = readJson(settingsPath);
  const predefinedCommands = buildPredefinedCommandSet();

  // Strip all predefined hook entries from current settings
  const currentHooks = settings.hooks ?? {};
  const cleaned = {};
  for (const [event, matcherArray] of Object.entries(currentHooks)) {
    const filteredMatchers = [];
    for (const matcherObj of matcherArray) {
      const filteredHooks = matcherObj.hooks.filter(h => !predefinedCommands.has(h.command));
      if (filteredHooks.length > 0) {
        filteredMatchers.push({ ...matcherObj, hooks: filteredHooks });
      }
    }
    if (filteredMatchers.length > 0) {
      cleaned[event] = filteredMatchers;
    }
  }

  // Inject selected groups back in
  const selectedGroups = HOOK_GROUPS.filter(g => selectedGroupNames.includes(g.name));
  for (const group of selectedGroups) {
    for (const [event, matcherArray] of Object.entries(group.hookGroup)) {
      if (!cleaned[event]) cleaned[event] = [];
      for (const matcherObj of matcherArray) {
        const existing = cleaned[event].find(m => m.matcher === matcherObj.matcher);
        if (existing) {
          existing.hooks.push(...matcherObj.hooks);
        } else {
          cleaned[event].push({ matcher: matcherObj.matcher, hooks: [...matcherObj.hooks] });
        }
      }
    }
  }

  const updated = { ...settings };
  if (Object.keys(cleaned).length === 0) {
    delete updated.hooks;
  } else {
    updated.hooks = cleaned;
  }
  writeJson(settingsPath, updated);
}

/**
 * Checks which precondition tools are missing from PATH.
 * @param {string[]} tools
 * @returns {string[]} missing tool names
 */
export function checkPreconditions(tools) {
  return tools.filter(tool => {
    const result = spawnSync('which', [tool], { encoding: 'utf8' });
    return result.status !== 0;
  });
}
