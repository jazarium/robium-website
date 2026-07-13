import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Demo } from './types.ts';

const here = dirname(fileURLToPath(import.meta.url));
let cache: Demo[] | null = null;

export function loadDemos(path = join(here, 'demos.json')): Demo[] {
  cache = JSON.parse(readFileSync(path, 'utf8')) as Demo[];
  return cache;
}

export function getDemo(id: string): Demo | undefined {
  return (cache ?? loadDemos()).find((d) => d.id === id);
}
