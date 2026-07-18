#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const forbiddenAnalyticsKeys = [
  'authorization',
  'cookie',
  'details',
  'email',
  'notes',
  'password',
  'prompt',
  'rawText',
  'refreshToken',
  'secret',
  'sourceText',
  'text',
  'token'
];

export async function collectAnalyticsPrivacyViolations(rootDir = process.cwd()) {
  const files = await listSourceFiles(path.join(rootDir, 'src'));
  const sources = await Promise.all(
    files.map(async (file) => ({
      file: path.relative(rootDir, file),
      text: await readFile(file, 'utf8')
    }))
  );
  return collectAnalyticsPrivacyViolationsFromSources(sources);
}

export function collectAnalyticsPrivacyViolationsFromSources(sources) {
  const violations = [];

  for (const source of sources) {
    violations.push(...findAnalyticsEventTypeViolations(source));
    violations.push(...findTrackCallViolations(source));
  }

  return violations;
}

function findAnalyticsEventTypeViolations(source) {
  const block = source.text.match(/export type AnalyticsEvent = \{[\s\S]*?\n\};/);
  if (!block) return [];
  return findForbiddenKeys(block[0]).map((key) => ({
    file: source.file,
    line: lineNumberAt(source.text, block.index ?? 0),
    key,
    context: 'AnalyticsEvent type'
  }));
}

function findTrackCallViolations(source) {
  const violations = [];
  const callPattern = /\btrack(?:Public)?Event\s*\(/g;
  let match;
  while ((match = callPattern.exec(source.text))) {
    const snippet = readCallSnippet(source.text, match.index);
    const keys = findForbiddenKeys(snippet);
    for (const key of keys) {
      violations.push({
        file: source.file,
        line: lineNumberAt(source.text, match.index),
        key,
        context: 'analytics call'
      });
    }
  }
  return violations;
}

function findForbiddenKeys(text) {
  return forbiddenAnalyticsKeys.filter((key) => {
    const pattern = new RegExp(`(?:^|[^\\w$])["']?${escapeRegExp(key)}["']?\\s*[?:]`, 'm');
    return pattern.test(text);
  });
}

function readCallSnippet(text, startIndex) {
  const endIndex = text.indexOf(');', startIndex);
  return text.slice(startIndex, endIndex === -1 ? startIndex + 500 : endIndex + 2);
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split('\n').length;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function listSourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listSourceFiles(fullPath));
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name) && !entry.name.includes('.test.')) {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  const violations = await collectAnalyticsPrivacyViolations();
  if (violations.length) {
    console.error('Analytics privacy audit failed.');
    for (const violation of violations) {
      console.error(`${violation.file}:${violation.line} uses forbidden analytics key "${violation.key}" in ${violation.context}.`);
    }
    process.exit(1);
  }
  console.log('Analytics privacy audit passed.');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
