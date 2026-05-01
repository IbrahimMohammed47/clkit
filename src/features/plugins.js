import { checkbox } from '@inquirer/prompts';
import pc from 'picocolors';
import {
  getInstalledPlugins,
  enablePlugin,
  disablePlugin,
} from '../utils/claude-cli.js';
import { getProjectSettingsPath, getProjectPlugins } from '../utils/settings.js';

/**
 * Renders the plugins wizard header.
 */
function renderHeader() {
  console.log('');
  console.log(
    pc.bgMagenta(pc.black(pc.bold('  ✦ clkit › Plugins Wizard  ')))
  );
  console.log(pc.dim('  Enable or disable Claude plugins for this project'));
  console.log('');
}

/**
 * Renders a summary after applying plugin changes.
 * @param {string[]} enabled
 * @param {string[]} disabled
 * @param {string[]} errors
 */
function renderSummary(enabled, disabled, errors) {
  console.log('');

  if (enabled.length === 0 && disabled.length === 0 && errors.length === 0) {
    console.log(pc.dim('  ○ No changes made.'));
  } else {
    if (enabled.length > 0) {
      console.log(pc.green(pc.bold(`  ✔ Enabled ${enabled.length} plugin(s):`)));
      enabled.forEach((p) => console.log(pc.green(`    + ${p}`)));
    }
    if (disabled.length > 0) {
      console.log(pc.red(pc.bold(`  ✖ Disabled ${disabled.length} plugin(s):`)));
      disabled.forEach((p) => console.log(pc.red(`    - ${p}`)));
    }
    if (errors.length > 0) {
      console.log(pc.yellow(pc.bold(`  ⚠  ${errors.length} error(s):`)));
      errors.forEach((e) => console.log(pc.yellow(`    ${e}`)));
    }
  }

  console.log('');
  console.log(
    pc.dim(`  Project settings: ${pc.underline(getProjectSettingsPath())}`)
  );
  console.log('');
}

/**
 * Main plugins wizard flow.
 * - Runs `claude plugins list` to get all known plugins (user + project scope)
 * - Shows a checkbox with current enabled/disabled state
 * - On confirm: calls `claude plugins enable/disable` for changed plugins only
 */
export async function pluginsWizard() {
  renderHeader();

  console.log(pc.dim('  Loading plugins via claude CLI…'));
  const plugins = getInstalledPlugins();
  console.log('');  // clear the loading line spacing

  if (plugins.length === 0) {
    console.log(
      pc.yellow(
        '  ⚠  No plugins found.\n' +
          '  Make sure the `claude` CLI is installed and you have plugins set up.\n' +
          '  Run: claude plugins list'
      )
    );
    console.log('');
    return;
  }

  // Detect plugins declared in project settings but not installed on this machine
  const projectPlugins = getProjectPlugins();
  const installedIds = new Set(plugins.map((p) => p.id));
  const missingPlugins = Object.keys(projectPlugins).filter((id) => !installedIds.has(id));

  if (missingPlugins.length > 0) {
    console.log(pc.yellow(pc.bold(
      `  ⚠  ${missingPlugins.length} plugin(s) are declared in this project but NOT installed on your machine:`
    )));
    console.log('');
    missingPlugins.forEach((id) => {
      const state = projectPlugins[id] ? pc.green('enabled') : pc.dim('disabled');
      console.log(pc.yellow(`    • ${pc.bold(id)}`) + pc.dim(` (${state} in settings)`));
    });
    console.log('');
    console.log(pc.dim('  These will not appear in the list below until installed.'));
    console.log('');
  }


  const termRows = process.stdout.rows ?? 24;
  const pageSize = Math.max(5, Math.min(plugins.length, termRows - 8));

  const choices = plugins.map((plugin) => {
    const scopeLabel = plugin.scope === 'user'
      ? pc.dim('(user)')
      : pc.dim('(project)');
    const label = plugin.enabled ? pc.cyan(plugin.id) : pc.white(plugin.id);
    const statusBadge = plugin.enabled
      ? pc.dim(' — enabled')
      : pc.dim(' — disabled');
    return {
      name: `${label}  ${scopeLabel}${statusBadge}`,
      value: plugin.id,
      checked: plugin.enabled,
    };
  });

  let selected;
  try {
    selected = await checkbox({
      message: 'Select plugins to enable in this project',
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

  // Determine what changed
  const toEnable = plugins.filter((p) => !p.enabled && selectedSet.has(p.id));
  const toDisable = plugins.filter((p) => p.enabled && !selectedSet.has(p.id));

  if (toEnable.length === 0 && toDisable.length === 0) {
    renderSummary([], [], []);
    return;
  }

  // Apply changes via the claude CLI
  const enabled = [];
  const disabled = [];
  const errors = [];

  for (const plugin of toEnable) {
    try {
      enablePlugin(plugin.id);
      enabled.push(plugin.id);
    } catch (err) {
      errors.push(`enable ${plugin.id}: ${err.message}`);
    }
  }

  for (const plugin of toDisable) {
    try {
      disablePlugin(plugin.id);
      disabled.push(plugin.id);
    } catch (err) {
      errors.push(`disable ${plugin.id}: ${err.message}`);
    }
  }

  renderSummary(enabled, disabled, errors);
}
