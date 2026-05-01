#!/usr/bin/env node

import { main } from '../src/index.js';

main().catch((err) => {
  if (err.name === 'ExitPromptError') {
    // User hit Ctrl+C — exit cleanly
    process.exit(0);
  }
  console.error(err);
  process.exit(1);
});
