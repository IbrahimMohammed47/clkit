import pc from 'picocolors';

export function renderWizardHeader(title, subtitle, bgColorFn) {
  console.log('');
  console.log(bgColorFn(pc.black(pc.bold(`  ✦ clkit › ${title}  `))));
  if (subtitle) console.log(pc.dim(`  ${subtitle}`));
  console.log('');
}
