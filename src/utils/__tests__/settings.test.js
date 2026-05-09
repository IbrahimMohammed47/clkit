import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  getProjectSettingsPath,
  initProjectStructure,
  hasProjectEnvVar,
  ensureProjectEnvVar,
  ensurePermissionDenyRule,
  getProjectPlugins,
  mergeProjectPlugins,
  getDisabledMcpServers,
  setDisabledMcpServers,
  getProjectLocalSettingsPath,
  readSkillOverrides,
  writeSkillOverrides,
} from '../settings.js';

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clkit-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function readSettings(cwd = tmpDir) {
  return JSON.parse(fs.readFileSync(getProjectSettingsPath(cwd), 'utf8'));
}

describe('initProjectStructure', () => {
  it('creates .claude/, .claude/skills/, and settings.json', () => {
    initProjectStructure(tmpDir);
    expect(fs.existsSync(path.join(tmpDir, '.claude'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.claude', 'skills'))).toBe(true);
    expect(fs.existsSync(getProjectSettingsPath(tmpDir))).toBe(true);
  });

  it('does not overwrite existing settings.json', () => {
    initProjectStructure(tmpDir);
    fs.writeFileSync(getProjectSettingsPath(tmpDir), JSON.stringify({ foo: 'bar' }, null, 2) + '\n');
    initProjectStructure(tmpDir);
    expect(readSettings()).toEqual({ foo: 'bar' });
  });
});

describe('hasProjectEnvVar', () => {
  it('returns false when env block missing', () => {
    initProjectStructure(tmpDir);
    expect(hasProjectEnvVar('MY_VAR', tmpDir)).toBe(false);
  });

  it('returns true when key present (even if false)', () => {
    initProjectStructure(tmpDir);
    ensureProjectEnvVar('MY_VAR', 'false', tmpDir);
    expect(hasProjectEnvVar('MY_VAR', tmpDir)).toBe(true);
  });
});

describe('ensureProjectEnvVar', () => {
  it('writes key/value when missing', () => {
    initProjectStructure(tmpDir);
    ensureProjectEnvVar('FOO', 'bar', tmpDir);
    expect(readSettings().env.FOO).toBe('bar');
  });

  it('no-ops when value already matches', () => {
    initProjectStructure(tmpDir);
    ensureProjectEnvVar('FOO', 'bar', tmpDir);
    const mtime1 = fs.statSync(getProjectSettingsPath(tmpDir)).mtimeMs;
    ensureProjectEnvVar('FOO', 'bar', tmpDir);
    const mtime2 = fs.statSync(getProjectSettingsPath(tmpDir)).mtimeMs;
    expect(mtime1).toBe(mtime2);
  });

  it('preserves existing keys', () => {
    initProjectStructure(tmpDir);
    ensureProjectEnvVar('A', '1', tmpDir);
    ensureProjectEnvVar('B', '2', tmpDir);
    expect(readSettings().env).toEqual({ A: '1', B: '2' });
  });
});

describe('ensurePermissionDenyRule', () => {
  it('adds rule when absent', () => {
    initProjectStructure(tmpDir);
    ensurePermissionDenyRule('Read(./.env)', tmpDir);
    expect(readSettings().permissions.deny).toContain('Read(./.env)');
  });

  it('no-ops when rule already present', () => {
    initProjectStructure(tmpDir);
    ensurePermissionDenyRule('Read(./.env)', tmpDir);
    ensurePermissionDenyRule('Read(./.env)', tmpDir);
    expect(readSettings().permissions.deny.filter(r => r === 'Read(./.env)')).toHaveLength(1);
  });

  it('preserves existing deny rules', () => {
    initProjectStructure(tmpDir);
    ensurePermissionDenyRule('Read(./.env)', tmpDir);
    ensurePermissionDenyRule('Grep(./.env)', tmpDir);
    expect(readSettings().permissions.deny).toContain('Read(./.env)');
    expect(readSettings().permissions.deny).toContain('Grep(./.env)');
  });
});

describe('getProjectPlugins / mergeProjectPlugins', () => {
  it('returns empty object when no plugins', () => {
    initProjectStructure(tmpDir);
    expect(getProjectPlugins(tmpDir)).toEqual({});
  });

  it('merges without clobbering keys from other users', () => {
    initProjectStructure(tmpDir);
    const settingsPath = getProjectSettingsPath(tmpDir);
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({ enabledPlugins: { 'other-user-plugin': true } }, null, 2) + '\n',
    );
    mergeProjectPlugins({ 'my-plugin': true }, tmpDir);
    expect(getProjectPlugins(tmpDir)).toEqual({
      'other-user-plugin': true,
      'my-plugin': true,
    });
  });
});

describe('getDisabledMcpServers / setDisabledMcpServers', () => {
  it('returns [] when key absent', () => {
    initProjectStructure(tmpDir);
    expect(getDisabledMcpServers(tmpDir)).toEqual([]);
  });

  it('round-trips a list', () => {
    initProjectStructure(tmpDir);
    setDisabledMcpServers(['foo', 'bar'], tmpDir);
    expect(getDisabledMcpServers(tmpDir)).toEqual(['foo', 'bar']);
  });

  it('removes the key when list is empty', () => {
    initProjectStructure(tmpDir);
    setDisabledMcpServers(['foo'], tmpDir);
    setDisabledMcpServers([], tmpDir);
    expect(readSettings()).not.toHaveProperty('disabledMcpjsonServers');
  });
});

describe('readSkillOverrides / writeSkillOverrides', () => {
  it('returns {} when file absent', () => {
    expect(readSkillOverrides(tmpDir)).toEqual({});
  });

  it('round-trips overrides without clobbering other keys', () => {
    const localPath = getProjectLocalSettingsPath(tmpDir);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, JSON.stringify({ otherKey: 42 }, null, 2) + '\n');
    writeSkillOverrides({ 'my-skill': 'off' }, tmpDir);
    const raw = JSON.parse(fs.readFileSync(localPath, 'utf8'));
    expect(raw.otherKey).toBe(42);
    expect(raw.skillOverrides).toEqual({ 'my-skill': 'off' });
  });
});
