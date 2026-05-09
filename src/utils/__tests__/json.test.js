import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { readJson, writeJson } from '../json.js';

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clkit-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('readJson', () => {
  it('returns {} for missing file', () => {
    expect(readJson(path.join(tmpDir, 'missing.json'))).toEqual({});
  });

  it('returns {} for malformed JSON', () => {
    const file = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(file, 'not json', 'utf8');
    expect(readJson(file)).toEqual({});
  });

  it('returns parsed object for valid JSON', () => {
    const file = path.join(tmpDir, 'data.json');
    fs.writeFileSync(file, JSON.stringify({ foo: 'bar' }), 'utf8');
    expect(readJson(file)).toEqual({ foo: 'bar' });
  });
});

describe('writeJson', () => {
  it('writes pretty-printed JSON with trailing newline', () => {
    const file = path.join(tmpDir, 'out.json');
    writeJson(file, { a: 1 });
    const raw = fs.readFileSync(file, 'utf8');
    expect(raw).toBe(JSON.stringify({ a: 1 }, null, 2) + '\n');
  });

  it('creates parent directories as needed', () => {
    const file = path.join(tmpDir, 'nested', 'dir', 'out.json');
    writeJson(file, {});
    expect(fs.existsSync(file)).toBe(true);
  });

  it('overwrites existing file', () => {
    const file = path.join(tmpDir, 'out.json');
    writeJson(file, { a: 1 });
    writeJson(file, { b: 2 });
    expect(readJson(file)).toEqual({ b: 2 });
  });
});
