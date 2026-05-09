import {
  createPrompt,
  useState,
  useKeypress,
  isEnterKey,
  isSpaceKey,
  isUpKey,
  isDownKey,
} from '@inquirer/core';
import pc from 'picocolors';

/**
 * Factory for a two-tab checkbox prompt.
 * @param {{ accentBg: Function, tabDescriptions?: string[] }} opts
 *   accentBg — picocolors background fn for the active tab (e.g. pc.bgCyan)
 *   tabDescriptions — optional per-tab description lines shown below the tab bar
 * @returns a createPrompt component callable as: await prompt({ tabs })
 *   tabs: [{ label: string, choices: [{ name, value, checked, tag? }] }]
 *   resolves to: [tab0SelectedValues[], tab1SelectedValues[]]
 */
export function createTabbedPrompt({ accentBg, tabDescriptions = [] }) {
  return createPrompt((config, done) => {
    const { tabs } = config;

    const [activeTab, setActiveTab] = useState(0);
    const [cursor, setCursor] = useState(0);
    const [sel0, setSel0] = useState(
      new Set(tabs[0].choices.filter((c) => c.checked).map((c) => c.value))
    );
    const [sel1, setSel1] = useState(
      new Set(tabs[1].choices.filter((c) => c.checked).map((c) => c.value))
    );

    useKeypress((key) => {
      const choices = tabs[activeTab].choices;

      if (isEnterKey(key)) {
        done([
          tabs[0].choices.filter((c) => sel0.has(c.value)).map((c) => c.value),
          tabs[1].choices.filter((c) => sel1.has(c.value)).map((c) => c.value),
        ]);
      } else if (key.name === 'left') {
        setActiveTab((activeTab - 1 + 2) % 2);
        setCursor(0);
      } else if (key.name === 'right') {
        setActiveTab((activeTab + 1) % 2);
        setCursor(0);
      } else if (isUpKey(key) && choices.length > 0) {
        setCursor((cursor - 1 + choices.length) % choices.length);
      } else if (isDownKey(key) && choices.length > 0) {
        setCursor((cursor + 1) % choices.length);
      } else if (isSpaceKey(key) && choices.length > 0) {
        const val = choices[cursor]?.value;
        if (!val) return;
        if (activeTab === 0) {
          const next = new Set(sel0);
          if (next.has(val)) next.delete(val);
          else next.add(val);
          setSel0(next);
        } else {
          const next = new Set(sel1);
          if (next.has(val)) next.delete(val);
          else next.add(val);
          setSel1(next);
        }
      }
    });

    const currentChoices = tabs[activeTab].choices;
    const currentSel = activeTab === 0 ? sel0 : sel1;

    const tabBar = tabs
      .map((t, i) =>
        i === activeTab
          ? accentBg(pc.black(pc.bold(` ${t.label} `)))
          : pc.dim(` ${t.label} `)
      )
      .join(pc.dim('│'));

    const description = tabDescriptions[activeTab]
      ? `\n${pc.dim(`  ${tabDescriptions[activeTab]}`)}`
      : '';

    const items =
      currentChoices.length === 0
        ? pc.dim('    (none)')
        : currentChoices
            .map((choice, i) => {
              const atCursor = i === cursor;
              const selected = currentSel.has(choice.value);
              const box = selected ? pc.green('◉') : pc.dim('◯');
              const label = selected
                ? pc.green(choice.name)
                : atCursor
                ? pc.cyan(choice.name)
                : choice.name;
              const pointer = atCursor ? pc.cyan('›') : ' ';
              const tag = choice.tag ? `  ${pc.dim(choice.tag)}` : '';
              return `  ${pointer} ${box}  ${label}${tag}`;
            })
            .join('\n');

    const hint = pc.dim('  ◄ ► tabs   ↑↓ move   Space toggle   Enter confirm');

    return `\n  ${tabBar}${description}\n\n${items}\n\n${hint}\n`;
  });
}
