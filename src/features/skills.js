import { checkbox } from '@inquirer/prompts';
import pc from 'picocolors';
import {
  collectGlobalSkills,
  getLocalSkillNames,
  copySkillToProject,
  removeSkillFromProject,
  getLocalSkillsDir,
} from '../utils/fs.js';
import { syncSkillPermissions } from '../utils/settings.js';

/**
 * Renders a styled header banner for the skills wizard.
 */
function renderHeader() {
  console.log('');
  console.log(
    pc.bgCyan(pc.black(pc.bold('  ✦ clkit › Skills Wizard  ')))
  );
  console.log(pc.dim('  Manage which global skills are copied into this project'));
  console.log('');
}

/**
 * Renders a styled summary of the sync operation.
 * @param {string[]} added
 * @param {string[]} removed
 */
function renderSummary(added, removed) {
  console.log('');
  if (added.length === 0 && removed.length === 0) {
    console.log(pc.dim('  ○ No changes made.'));
  } else {
    if (added.length > 0) {
      console.log(pc.green(pc.bold(`  ✔ Added ${added.length} skill(s):`)));
      added.forEach((s) => console.log(pc.green(`    + ${s}`)));
    }
    if (removed.length > 0) {
      console.log(pc.red(pc.bold(`  ✖ Removed ${removed.length} skill(s):`)));
      removed.forEach((s) => console.log(pc.red(`    - ${s}`)));
    }
  }
  console.log('');
  console.log(
    pc.dim(`  Project skills dir: ${pc.underline(getLocalSkillsDir())}`)
  );
  console.log('');
}

/**
 * Main skills wizard flow.
 * - Discovers all global skills (deduplicated by priority).
 * - Shows a checkbox prompt pre-selecting skills already in the project.
 * - Syncs additions and removals to the project's .claude/skills directory.
 */
export async function skillsWizard() {
  renderHeader();

  const globalSkills = collectGlobalSkills();

  if (globalSkills.length === 0) {
    console.log(
      pc.yellow(
        '  ⚠  No global skills found.\n' +
          '  Expected skill folders in one of:\n' +
          '    ~/.claude/skills/<skill-name>/\n' +
          '    ~/.agents/skills/<skill-name>/\n' +
          '    ~/.gemini/skills/<skill-name>/\n' +
          '    ~/.cursor/skills/<skill-name>/'
      )
    );
    console.log('');
    return;
  }

  const localSkillNames = getLocalSkillNames();

  const choices = globalSkills.map((skill) => {
    const isLocal = localSkillNames.has(skill.name);
    const label = isLocal ? pc.cyan(skill.name) : pc.white(skill.name);
    const source = pc.dim(`(${skill.sourceLabel})`);
    const suffix = isLocal ? pc.dim(' — already in project') : '';
    return {
      name: `${label}  ${source}${suffix}`,
      value: skill.name,
      checked: isLocal,
    };
  });

  // Build a lookup map for quick access to source paths
  const skillMap = new Map(globalSkills.map((s) => [s.name, s]));

  // Reserve ~8 rows for header, prompt line, instructions, and bottom margin
  const termRows = process.stdout.rows ?? 24;
  const pageSize = Math.max(5, Math.min(globalSkills.length, termRows - 8));

  let selected;
  try {
    selected = await checkbox({
      message: 'Select skills to include in this project',
      choices,
      pageSize,
      loop: false,
      instructions: pc.dim(
        '  (Space to toggle, A to select all, I to invert, Enter to confirm)'
      ),
    });
  } catch (err) {
    if (err.name === 'ExitPromptError') return;
    throw err;
  }

  const selectedSet = new Set(selected);

  // Skills to add: selected but not yet local
  const toAdd = selected
    .filter((name) => !localSkillNames.has(name))
    .map((name) => skillMap.get(name));

  // Skills to remove: was local but now deselected
  const toRemove = [...localSkillNames].filter((name) => !selectedSet.has(name));

  // Apply changes
  for (const skill of toAdd) {
    copySkillToProject(skill);
  }
  for (const name of toRemove) {
    removeSkillFromProject(name);
  }

  // Sync deny rules for unselected skills
  const allSkillNames = globalSkills.map((s) => s.name);
  const deniedSkills = syncSkillPermissions(selected, allSkillNames);

  renderSummary(
    toAdd.map((s) => s.name),
    toRemove
  );

  // Warn about denied skills
  if (deniedSkills.length > 0) {
    console.log(
      pc.yellow(
        `  ⚠  Denied ${deniedSkills.length} skill(s) outside project scope:\n` +
          deniedSkills.map((s) => `    • ${s}`).join('\n')
      )
    );
    console.log('');
  }
}
