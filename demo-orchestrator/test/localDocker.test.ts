import { afterAll, expect, test } from 'vitest';
import Docker from 'dockerode';
import { LocalDockerDriver } from '../src/localDocker.ts';
import { getDemo } from '../src/registry.ts';

const docker = new Docker();
let available = false;
try {
  await docker.ping();
  available = true;
} catch {
  /* no docker — test skips */
}
const maybe = available ? test : test.skip;

const driver = new LocalDockerDriver();
let id = '';

maybe(
  'start → list → stop round-trip',
  async () => {
    const demo = getDemo('nav-trial')!;
    const inst = await driver.start(demo, 'test-session');
    id = inst.id;
    expect(inst.host).toMatch(/^localhost:\d+$/);
    const running = await driver.list();
    expect(running.find((i) => i.id === id)).toBeTruthy();
    await driver.stop(id);
    const after = await driver.list();
    expect(after.find((i) => i.id === id)).toBeFalsy();
  },
  60_000,
);

afterAll(async () => {
  if (id) await driver.stop(id).catch(() => {});
});
