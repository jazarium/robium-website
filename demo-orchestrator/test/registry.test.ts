import { expect, test } from 'vitest';
import { loadDemos, getDemo } from '../src/registry.ts';

test('loads seeded nav-trial demo', () => {
  const demos = loadDemos();
  expect(demos.find((d) => d.id === 'nav-trial')).toBeTruthy();
});

test('getDemo returns undefined for unknown id', () => {
  expect(getDemo('nope')).toBeUndefined();
});

test('getDemo returns the nav-trial demo with its limit', () => {
  expect(getDemo('nav-trial')?.maxInstances).toBe(3);
});
