import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  getLocalSkillsDir,
  getLocalSkillNames,
  copySkillToProject,
  removeSkillFromProject,
  collectAllSkills,
} from '../fs.js';

let tmpDir;
let userSkillsDir; // controlled substitute for ~/.claude/skills

function makeSkill(baseDir, name, fileName = 'SKILL.md') {
  const skillDir = path.join(baseDir, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, fileName), `# ${name}`, 'utf8');
  return skillDir;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clkit-test-'));
  userSkillsDir = path.join(tmpDir, 'user-skills');
  fs.mkdirSync(userSkillsDir, { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('getLocalSkillsDir', () => {
  it('returns .claude/skills under cwd', () => {
    expect(getLocalSkillsDir(tmpDir)).toBe(path.join(tmpDir, '.claude', 'skills'));
  });
});

describe('getLocalSkillNames', () => {
  it('returns empty Set when dir absent', () => {
    expect(getLocalSkillNames(tmpDir).size).toBe(0);
  });

  it('returns skill names present in .claude/skills/', () => {
    const localSkills = path.join(tmpDir, '.claude', 'skills');
    makeSkill(localSkills, 'alpha');
    makeSkill(localSkills, 'beta');
    const names = getLocalSkillNames(tmpDir);
    expect(names.has('alpha')).toBe(true);
    expect(names.has('beta')).toBe(true);
  });
});

describe('copySkillToProject', () => {
  it('copies skill folder into .claude/skills/', () => {
    makeSkill(userSkillsDir, 'my-skill');
    const skill = { name: 'my-skill', userSourcePath: path.join(userSkillsDir, 'my-skill') };
    copySkillToProject(skill, tmpDir);
    const destFile = path.join(tmpDir, '.claude', 'skills', 'my-skill', 'SKILL.md');
    expect(fs.existsSync(destFile)).toBe(true);
  });

  it('creates .claude/skills/ if it does not exist', () => {
    makeSkill(userSkillsDir, 'my-skill');
    copySkillToProject(
      { name: 'my-skill', userSourcePath: path.join(userSkillsDir, 'my-skill') },
      tmpDir,
    );
    expect(fs.existsSync(getLocalSkillsDir(tmpDir))).toBe(true);
  });
});

describe('removeSkillFromProject', () => {
  it('removes skill folder from .claude/skills/', () => {
    const localSkills = path.join(tmpDir, '.claude', 'skills');
    makeSkill(localSkills, 'to-remove');
    removeSkillFromProject('to-remove', tmpDir);
    expect(fs.existsSync(path.join(localSkills, 'to-remove'))).toBe(false);
  });

  it('does not throw when skill does not exist', () => {
    expect(() => removeSkillFromProject('ghost', tmpDir)).not.toThrow();
  });
});

describe('collectAllSkills', () => {
  it('returns empty array when no skills anywhere', () => {
    expect(collectAllSkills(tmpDir, userSkillsDir)).toEqual([]);
  });

  it('tags user-only skills correctly', () => {
    makeSkill(userSkillsDir, 'user-skill');
    const skills = collectAllSkills(tmpDir, userSkillsDir);
    const s = skills.find(sk => sk.name === 'user-skill');
    expect(s).toBeDefined();
    expect(s.sources).toContain('user');
    expect(s.sources).not.toContain('project');
    expect(s.userSourcePath).toBe(path.join(userSkillsDir, 'user-skill'));
  });

  it('tags project-only skills correctly', () => {
    makeSkill(path.join(tmpDir, '.claude', 'skills'), 'proj-skill');
    const skills = collectAllSkills(tmpDir, userSkillsDir);
    const s = skills.find(sk => sk.name === 'proj-skill');
    expect(s).toBeDefined();
    expect(s.sources).toContain('project');
    expect(s.sources).not.toContain('user');
  });

  it('tags skills present in both sources correctly', () => {
    makeSkill(userSkillsDir, 'shared');
    makeSkill(path.join(tmpDir, '.claude', 'skills'), 'shared');
    const skills = collectAllSkills(tmpDir, userSkillsDir);
    const s = skills.find(sk => sk.name === 'shared');
    expect(s.sources).toContain('user');
    expect(s.sources).toContain('project');
  });

  it('returns skills sorted alphabetically', () => {
    makeSkill(path.join(tmpDir, '.claude', 'skills'), 'zebra');
    makeSkill(path.join(tmpDir, '.claude', 'skills'), 'alpha');
    const skills = collectAllSkills(tmpDir, userSkillsDir);
    const names = skills.map(s => s.name);
    expect(names).toEqual([...names].sort());
  });
});
