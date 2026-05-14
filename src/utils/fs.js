import os from 'os';
import path from 'path';
import fs from 'fs';

const USER_SKILLS_DIR = path.join(os.homedir(), '.claude', 'skills');

/**
 * Ordered list of global skill source directories.
 * Higher index = lower priority. First match wins for duplicates.
 */
const GLOBAL_SKILL_DIRS = [
  USER_SKILLS_DIR,
  path.join(os.homedir(), '.agents', 'skills'),
  path.join(os.homedir(), '.gemini', 'skills'),
  path.join(os.homedir(), '.cursor', 'skills'),
];

/**
 * Returns names of all immediate subdirectories (including symlinks to dirs).
 * @param {string} dirPath
 * @returns {string[]}
 */
function listSkillFolders(dirPath) {
  try {
    return fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((e) => {
        if (e.isDirectory()) return true;
        if (e.isSymbolicLink()) {
          try {
            return fs.statSync(path.join(dirPath, e.name)).isDirectory();
          } catch {
            return false;
          }
        }
        return false;
      })
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Collects all unique skill names from global source directories,
 * applying priority deduplication (first source with a given skill name wins).
 * @returns {{ name: string; sourcePath: string; sourceLabel: string }[]}
 */
export function collectGlobalSkills() {
  const seen = new Map();

  for (const sourceDir of GLOBAL_SKILL_DIRS) {
    for (const skillName of listSkillFolders(sourceDir)) {
      if (!seen.has(skillName)) {
        seen.set(skillName, { sourcePath: path.join(sourceDir, skillName), sourceDir });
      }
    }
  }

  return Array.from(seen.entries()).map(([name, { sourcePath, sourceDir }]) => {
    const relativeDir = path.relative(os.homedir(), sourceDir);
    const sourceLabel = '~' + path.sep + relativeDir;
    return { name, sourcePath, sourceLabel };
  });
}

/**
 * Collects all skills from the user skills dir and the project skills dir,
 * returning each skill's name, which sources it appears in, and its user-side path.
 * @param {string} [cwd]
 * @returns {{ name: string; sources: string[]; userSourcePath?: string }[]}
 */
export function collectAllSkills(cwd = process.cwd(), userSkillsDir = USER_SKILLS_DIR) {
  const projectSkillsDir = path.join(cwd, '.claude', 'skills');
  const skillMap = new Map();

  for (const name of listSkillFolders(userSkillsDir)) {
    skillMap.set(name, {
      name,
      sources: ['user'],
      userSourcePath: path.join(userSkillsDir, name),
    });
  }
  for (const name of listSkillFolders(projectSkillsDir)) {
    if (skillMap.has(name)) {
      skillMap.get(name).sources.push('project');
    } else {
      skillMap.set(name, { name, sources: ['project'] });
    }
  }

  return [...skillMap.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Returns the path to the local project's skills directory.
 * @param {string} [cwd]
 * @returns {string}
 */
export function getLocalSkillsDir(cwd = process.cwd()) {
  return path.join(cwd, '.claude', 'skills');
}

/**
 * Returns a Set of skill names currently present in the local project's skills dir.
 * @param {string} [cwd]
 * @returns {Set<string>}
 */
export function getLocalSkillNames(cwd = process.cwd()) {
  return new Set(listSkillFolders(getLocalSkillsDir(cwd)));
}

/**
 * Copies a skill folder into the local project's skills directory.
 * Dereferences symlinks so the copy is self-contained.
 * @param {{ name: string; userSourcePath: string }} skill
 * @param {string} [cwd]
 */
export function copySkillToProject(skill, cwd = process.cwd()) {
  const localDir = getLocalSkillsDir(cwd);
  const destDir = path.join(localDir, skill.name);
  fs.mkdirSync(localDir, { recursive: true });
  const realSrc = fs.realpathSync(skill.userSourcePath);
  fs.cpSync(realSrc, destDir, { recursive: true, dereference: true });
}

/**
 * Removes a skill folder from the local project's skills directory.
 * @param {string} skillName
 * @param {string} [cwd]
 */
export function removeSkillFromProject(skillName, cwd = process.cwd()) {
  const destDir = path.join(getLocalSkillsDir(cwd), skillName);
  fs.rmSync(destDir, { recursive: true, force: true });
}

/**
 * Ensures CLAUDE.md is a bridge to AGENTS.md (@AGENTS.md).
 * Handles migration of existing CLAUDE.md content to AGENTS.md.
 * Scenario matrix:
 * - Neither exists: no-op
 * - Only AGENTS.md exists: create CLAUDE.md = @AGENTS.md
 * - Only CLAUDE.md exists (bridge): no-op
 * - Only CLAUDE.md exists (content): move to AGENTS.md, replace with bridge
 * - Both exist (CLAUDE.md has content): warn, touch nothing (user must manually merge)
 * @param {string} [cwd]
 */
export function ensureAgentsBridge(cwd = process.cwd()) {
  const BRIDGE = '@AGENTS.md';
  const claudePath = path.join(cwd, 'CLAUDE.md');
  const agentsPath = path.join(cwd, 'AGENTS.md');

  const claudeExists = fs.existsSync(claudePath);
  const agentsExists = fs.existsSync(agentsPath);

  if (!claudeExists && !agentsExists) return;

  if (!claudeExists) {
    fs.writeFileSync(claudePath, `${BRIDGE}\n`, 'utf8');
    return;
  }

  const claudeContent = fs.readFileSync(claudePath, 'utf8');
  if (claudeContent.trim() === BRIDGE) return;

  if (!agentsExists) {
    fs.writeFileSync(agentsPath, claudeContent, 'utf8');
    fs.writeFileSync(claudePath, `${BRIDGE}\n`, 'utf8');
  } else {
    console.warn(
      '  ⚠ CLAUDE.md and AGENTS.md both have content. Manually merge CLAUDE.md into AGENTS.md, then replace CLAUDE.md with: @AGENTS.md'
    );
  }
}
