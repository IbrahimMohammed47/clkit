import { checkbox } from '@inquirer/prompts';
import pc from 'picocolors';
import { renderWizardHeader } from '../utils/ui.js';
import {
  getHookGroups,
  getEnabledGroupNames,
  applyHookGroups,
  checkPreconditions,
} from '../utils/hooks.js';
import { getProjectSettingsPath } from '../utils/settings.js';


function renderSummary(added, removed) {
  console.log('');
  if (added.length === 0 && removed.length === 0) {
    console.log(pc.dim('  ○ No changes made.'));
  } else {
    if (added.length > 0) {
      console.log(pc.green(pc.bold(`  ✔ Enabled ${added.length} hook group(s):`)));
      added.forEach(n => console.log(pc.green(`    + ${n}`)));
    }
    if (removed.length > 0) {
      console.log(pc.red(pc.bold(`  ✖ Disabled ${removed.length} hook group(s):`)));
      removed.forEach(n => console.log(pc.red(`    - ${n}`)));
    }
  }
  console.log('');
  console.log(pc.dim(`  Project settings: ${pc.underline(getProjectSettingsPath())}`));
  console.log('');
}

export async function hookGroupsWizard() {
  renderWizardHeader('Hook Groups Wizard', 'Enable predefined hook groups in this project', pc.bgYellow);

  const groups = getHookGroups();
  const enabledNames = new Set(getEnabledGroupNames());

  const termRows = process.stdout.rows ?? 24;
  const pageSize = Math.max(5, Math.min(groups.length, termRows - 8));

  const choices = groups.map(group => {
    const isEnabled = enabledNames.has(group.name);
    const label = isEnabled ? pc.cyan(group.name) : pc.white(group.name);
    const preconditions = group.preconditions ?? [];
    const prereqBadge = preconditions.length > 0 
      ? pc.dim(`[needs: ${preconditions.join(', ')}]`)
      : '';
    const statusBadge = isEnabled ? pc.dim(' — enabled') : '';
    return {
      name: `${label}  ${prereqBadge}  ${pc.dim(group.description)}${statusBadge}`,
      value: group.name,
      checked: isEnabled,
    };
  });

  let selected;
  try {
    selected = await checkbox({
      message: 'Select hook groups to enable in this project',
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
  const toAdd = selected.filter(n => !enabledNames.has(n));
  const toRemove = [...enabledNames].filter(n => !selectedSet.has(n));

  if (toAdd.length === 0 && toRemove.length === 0) {
    renderSummary([], []);
    return;
  }

  // Check preconditions for newly selected groups
  const groupMap = new Map(groups.map(g => [g.name, g]));
  const preconditionWarnings = [];
  for (const name of toAdd) {
    const group = groupMap.get(name);
    const missing = checkPreconditions(group.preconditions ?? []);
    if (missing.length > 0) {
      preconditionWarnings.push({ name, missing });
    }
  }

  if (preconditionWarnings.length > 0) {
    console.log('');
    console.log(pc.yellow(pc.bold('  ⚠  Precondition warnings (hooks will still be added):')));
    for (const { name, missing } of preconditionWarnings) {
      console.log(pc.yellow(`    ${name}: missing ${missing.map(t => pc.bold(t)).join(', ')}`));
    }
  }

  applyHookGroups(selected);
  renderSummary(toAdd, toRemove);
}
