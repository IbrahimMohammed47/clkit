import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getHookGroups, getEnabledGroupNames, applyHookGroups, checkPreconditions } from '../hooks.js';
import { initProjectStructure, getProjectSettingsPath } from '../settings.js';

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clkit-test-'));
  initProjectStructure(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function readSettings() {
  return JSON.parse(fs.readFileSync(getProjectSettingsPath(tmpDir), 'utf8'));
}

describe('getHookGroups', () => {
  it('returns non-empty array with name and hookGroup fields', () => {
    const groups = getHookGroups();
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0]).toHaveProperty('name');
    expect(groups[0]).toHaveProperty('hookGroup');
  });
});

describe('getEnabledGroupNames', () => {
  it('returns [] when no hooks in settings', () => {
    expect(getEnabledGroupNames(tmpDir)).toEqual([]);
  });

  it('detects a fully applied group', () => {
    const [group] = getHookGroups();
    applyHookGroups([group.name], tmpDir);
    expect(getEnabledGroupNames(tmpDir)).toContain(group.name);
  });

  it('ignores a partially applied group', () => {
    const [group] = getHookGroups();
    // Write only the first event's first matcher — incomplete
    const [firstEvent, matcherArray] = Object.entries(group.hookGroup)[0];
    const partial = { [firstEvent]: [matcherArray[0]] };
    const settingsPath = getProjectSettingsPath(tmpDir);
    const existing = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    fs.writeFileSync(settingsPath, JSON.stringify({ ...existing, hooks: partial }, null, 2) + '\n');
    expect(getEnabledGroupNames(tmpDir)).not.toContain(group.name);
  });
});

describe('applyHookGroups', () => {
  it('adds hooks for selected groups', () => {
    const [group] = getHookGroups();
    applyHookGroups([group.name], tmpDir);
    expect(readSettings().hooks).toBeDefined();
  });

  it('removes hooks when group deselected', () => {
    const [group] = getHookGroups();
    applyHookGroups([group.name], tmpDir);
    applyHookGroups([], tmpDir);
    expect(readSettings().hooks).toBeUndefined();
  });

  it('preserves user-added hooks not in any predefined group', () => {
    const settingsPath = getProjectSettingsPath(tmpDir);
    const userHook = {
      PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo user-hook' }] }],
    };
    const existing = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    fs.writeFileSync(settingsPath, JSON.stringify({ ...existing, hooks: userHook }, null, 2) + '\n');

    applyHookGroups([], tmpDir);

    const hooks = readSettings().hooks;
    expect(hooks?.PostToolUse?.some(m => m.matcher === 'Bash')).toBe(true);
  });
});

describe('checkPreconditions', () => {
  it('returns [] for tools that exist', () => {
    expect(checkPreconditions(['node'])).toEqual([]);
  });

  it('returns missing tool names', () => {
    const missing = checkPreconditions(['__tool_that_does_not_exist_xyz__']);
    expect(missing).toContain('__tool_that_does_not_exist_xyz__');
  });
});
