import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  getMcpFilePath,
  readMcpConfig,
  writeMcpConfig,
  extractEnvVarRefs,
  buildServerConfig,
} from '../mcp.js';

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clkit-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('getMcpFilePath', () => {
  it('returns .claude/.mcp.json under cwd', () => {
    expect(getMcpFilePath(tmpDir)).toBe(path.join(tmpDir, '.claude', '.mcp.json'));
  });
});

describe('readMcpConfig', () => {
  it('returns {mcpServers:{}} when file absent', () => {
    expect(readMcpConfig(tmpDir)).toEqual({ mcpServers: {} });
  });

  it('returns {mcpServers:{}} for malformed JSON', () => {
    const file = getMcpFilePath(tmpDir);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'not json', 'utf8');
    expect(readMcpConfig(tmpDir)).toEqual({ mcpServers: {} });
  });

  it('returns parsed config for valid file', () => {
    const config = { mcpServers: { foo: { command: 'bar' } } };
    writeMcpConfig(config, tmpDir);
    expect(readMcpConfig(tmpDir)).toEqual(config);
  });
});

describe('writeMcpConfig', () => {
  it('writes formatted JSON with trailing newline', () => {
    const config = { mcpServers: { foo: { command: 'bar' } } };
    writeMcpConfig(config, tmpDir);
    const raw = fs.readFileSync(getMcpFilePath(tmpDir), 'utf8');
    expect(raw).toBe(JSON.stringify(config, null, 2) + '\n');
  });

  it('creates parent directories', () => {
    writeMcpConfig({ mcpServers: {} }, tmpDir);
    expect(fs.existsSync(getMcpFilePath(tmpDir))).toBe(true);
  });
});

describe('extractEnvVarRefs', () => {
  it('extracts ${VAR} patterns', () => {
    expect(extractEnvVarRefs('${FOO}')).toContain('FOO');
  });

  it('extracts ${VAR:-default} patterns', () => {
    expect(extractEnvVarRefs('${BAR:-default}')).toContain('BAR');
  });

  it('deduplicates repeated vars', () => {
    const refs = extractEnvVarRefs('${FOO} and ${FOO}');
    expect(refs.filter(r => r === 'FOO')).toHaveLength(1);
  });

  it('scans nested objects and arrays', () => {
    const refs = extractEnvVarRefs({ a: { b: ['${NESTED}'] } });
    expect(refs).toContain('NESTED');
  });

  it('returns [] for no matches', () => {
    expect(extractEnvVarRefs('no vars here')).toEqual([]);
  });
});

describe('buildServerConfig', () => {
  it('builds stdio config with command', () => {
    const cfg = buildServerConfig({ transport: 'stdio', command: 'npx', args: ['foo'] });
    expect(cfg).toEqual({ command: 'npx', args: ['foo'] });
  });

  it('omits args when empty', () => {
    const cfg = buildServerConfig({ transport: 'stdio', command: 'npx', args: [] });
    expect(cfg).not.toHaveProperty('args');
  });

  it('builds http config with url', () => {
    const cfg = buildServerConfig({ transport: 'http', url: 'http://localhost:3000' });
    expect(cfg).toEqual({ type: 'http', url: 'http://localhost:3000' });
  });

  it('includes env when provided', () => {
    const cfg = buildServerConfig({ transport: 'stdio', command: 'x', env: { KEY: 'val' } });
    expect(cfg.env).toEqual({ KEY: 'val' });
  });

  it('omits env when empty', () => {
    const cfg = buildServerConfig({ transport: 'stdio', command: 'x', env: {} });
    expect(cfg).not.toHaveProperty('env');
  });
});
