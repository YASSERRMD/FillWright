#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const EM_DASH = '\u2014';
const EN_DASH = '\u2013';
const srcDir = 'src';

const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.md', '.json']);

function checkDirectory(dir) {
  const files = readdirSync(dir);
  let hasViolation = false;

  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      if (checkDirectory(filePath)) {
        hasViolation = true;
      }
    } else if (allowedExtensions.has(extname(file))) {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes(EM_DASH) || line.includes(EN_DASH)) {
          console.error(`${filePath}:${i + 1}: em dash or en dash found`);
          hasViolation = true;
        }
      }
    }
  }

  return hasViolation;
}

const hasViolation = checkDirectory(srcDir);

if (hasViolation) {
  console.error('\nError: em dashes or en dashes found in source files.');
  console.error('Please use "--" (double hyphen) instead.\n');
  process.exit(1);
} else {
  console.log('No em dashes found in source files.');
  process.exit(0);
}
