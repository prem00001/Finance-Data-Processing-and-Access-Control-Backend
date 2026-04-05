'use strict';

const path = require('path');
const fs = require('fs');

const candidates = [
  path.join(__dirname, 'dist', 'main.js'),
  path.join(__dirname, 'dist', 'src', 'main.js'),
];

const entry = candidates.find((f) => fs.existsSync(f));
if (!entry) {
  console.error(
    '[start] Compiled app not found. Expected one of:\n  %s\nBuild with: npm run build\nCurrent cwd: %s',
    candidates.join('\n  '),
    process.cwd(),
  );
  process.exit(1);
}

require(entry);
