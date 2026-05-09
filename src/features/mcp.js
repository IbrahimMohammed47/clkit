import { createRequire } from 'module';
import pc from 'picocolors';
import { renderWizardHeader } from '../utils/ui.js';
import { createTabbedPrompt } from '../utils/tabbed-prompt.js';
import { listMcpServers } from '../utils/claude-cli.js';
import { getDisabledMcpServers, setDisabledMcpServers } from '../utils/settings.js';
import { readMcpConfig, writeMcpConfig } from '../utils/mcp.js';

const require = createRequire(import.meta.url);
const PREDEFINED = require('../data/mcps.json');


const tabbedMcpPrompt = createTabbedPrompt({ accentBg: pc.bgBlue });

export async function mcpWizard() {
  renderWizardHeader('MCP Wizard', 'Manage MCP servers for this project', pc.bgBlue);

  console.log(pc.dim('  Loading MCP servers via claude CLI…'));
  const allInstalled = listMcpServers();
  const disabled = getDisabledMcpServers();
  const disabledSet = new Set(disabled);

  const predefinedServers = PREDEFINED.mcpServers;
  const predefinedNames = Object.keys(predefinedServers);

  const currentMcp = readMcpConfig();
  const currentMcpNames = new Set(Object.keys(currentMcp.mcpServers));

  console.log('');

  let result;
  try {
    result = await tabbedMcpPrompt({
      tabs: [
        {
          label: 'Installed',
          choices: allInstalled.map((name) => ({
            name,
            value: name,
            checked: !disabledSet.has(name),
          })),
        },
        {
          label: 'Predefined',
          choices: predefinedNames.map((name) => ({
            name,
            value: name,
            checked: currentMcpNames.has(name),
          })),
        },
      ],
    });
  } catch (err) {
    if (err.name === 'ExitPromptError') return;
    throw err;
  }

  const [selectedInstalled, selectedPredefined] = result;
  console.log('');

  // Apply installed changes
  if (allInstalled.length > 0) {
    const activeSet = new Set(selectedInstalled);
    const nowDisabled = allInstalled.filter((n) => !activeSet.has(n));
    setDisabledMcpServers(nowDisabled);

    const reenabled = allInstalled.filter((n) => disabledSet.has(n) && activeSet.has(n));
    const newlyDisabled = allInstalled.filter((n) => !disabledSet.has(n) && !activeSet.has(n));

    if (reenabled.length > 0)
      console.log(pc.green(pc.bold(`  ✔ Re-enabled: ${reenabled.join(', ')}`)));
    if (newlyDisabled.length > 0)
      console.log(pc.red(pc.bold(`  ✖ Disabled: ${newlyDisabled.join(', ')}`)));
    if (reenabled.length === 0 && newlyDisabled.length === 0)
      console.log(pc.dim('  ○ No changes to installed servers.'));
    console.log(pc.dim('  Written to: disabledMcpjsonServers in .claude/settings.json'));
    console.log('');
  }

  // Apply predefined changes
  const selectedPredSet = new Set(selectedPredefined);
  const added = predefinedNames.filter((n) => !currentMcpNames.has(n) && selectedPredSet.has(n));
  const removed = predefinedNames.filter((n) => currentMcpNames.has(n) && !selectedPredSet.has(n));

  if (added.length > 0 || removed.length > 0) {
    const updatedMcp = { ...currentMcp, mcpServers: { ...currentMcp.mcpServers } };
    for (const n of added) updatedMcp.mcpServers[n] = predefinedServers[n];
    for (const n of removed) delete updatedMcp.mcpServers[n];
    writeMcpConfig(updatedMcp);

    if (added.length > 0)
      console.log(pc.green(pc.bold(`  ✔ Added to .mcp.json: ${added.join(', ')}`)));
    if (removed.length > 0)
      console.log(pc.red(pc.bold(`  ✖ Removed from .mcp.json: ${removed.join(', ')}`)));
    console.log(pc.dim('  Written to: .claude/.mcp.json'));
  } else {
    console.log(pc.dim('  ○ No changes to predefined servers.'));
  }
  console.log('');
}
