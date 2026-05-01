import os from 'os';
import path from 'path';
import fs from 'fs';

/**
 * Ordered list of global skill source directories.
 * Higher index = lower priority. First match wins for duplicates.
 */
const GLOBAL_SKILL_DIRS = [
  path.join(os.homedir(), '.claude', 'skills'),
  path.join(os.homedir(), '.agents', 'skills'),
  path.join(os.homedir(), '.gemini', 'skills'),
  path.join(os.homedir(), '.cursor', 'skills'),
];

/**
 * Scans a directory and returns an array of immediate subdirectory names.
 * Each subdirectory represents a skill (expected: skills/<skill-name>/SKILL.md).
 * Returns [] if the directory doesn't exist or can't be read.
 * @param {string} dirPath
 * @returns {string[]}
 */
function listSkillFolders(dirPath) {
  try {
    return fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

/**
 * Collects all unique skill names from global source directories,
 * applying priority deduplication (first source with a given skill name wins).
 *
 * @returns {{ name: string; sourcePath: string }[]}
 */
export function collectGlobalSkills() {
  // Map: skill name -> { sourcePath, sourceDir }
  const seen = new Map();

  for (const sourceDir of GLOBAL_SKILL_DIRS) {
    const skillNames = listSkillFolders(sourceDir);
    for (const skillName of skillNames) {
      if (!seen.has(skillName)) {
        seen.set(skillName, { sourcePath: path.join(sourceDir, skillName), sourceDir });
      }
    }
  }

  return Array.from(seen.entries()).map(([name, { sourcePath, sourceDir }]) => {
    // Build a friendly label like ~/.claude/skills
    const relativeDir = path.relative(os.homedir(), sourceDir);
    const sourceLabel = '~' + path.sep + relativeDir;
    return { name, sourcePath, sourceLabel };
  });
}

/**
 * Returns the path to the local project's skills directory.
 * @returns {string}
 */
export function getLocalSkillsDir() {
  return path.join(process.cwd(), '.claude', 'skills');
}

/**
 * Returns a Set of skill names currently present in the local project's skills dir.
 * @returns {Set<string>}
 */
export function getLocalSkillNames() {
  const localDir = getLocalSkillsDir();
  const names = listSkillFolders(localDir);
  return new Set(names);
}

/**
 * Copies a skill folder (and all its contents) into the local project's skills directory.
 * Uses Node's built-in fs.cpSync (available in Node 16.7+) for cross-platform compatibility.
 * @param {{ name: string; sourcePath: string }} skill
 */
export function copySkillToProject(skill) {
  const destDir = path.join(getLocalSkillsDir(), skill.name);
  fs.mkdirSync(getLocalSkillsDir(), { recursive: true });
  fs.cpSync(skill.sourcePath, destDir, { recursive: true });
}

/**
 * Removes a skill folder from the local project's skills directory.
 * @param {string} skillName
 */
export function removeSkillFromProject(skillName) {
  const destDir = path.join(getLocalSkillsDir(), skillName);
  fs.rmSync(destDir, { recursive: true, force: true });
}
