import Docker from 'dockerode';
import type { Demo, Instance } from './types.ts';
import type { Driver } from './driver.ts';

const LABEL = 'robium.demo'; // marks our containers
const SESSION_LABEL = 'robium.session';
const DEMO_LABEL = 'robium.demoId';

export class LocalDockerDriver implements Driver {
  #docker = new Docker();

  async start(demo: Demo, session: string): Promise<Instance> {
    const container = await this.#docker.createContainer({
      Image: demo.image,
      Cmd: demo.command,
      Env: Object.entries(demo.env ?? {}).map(([k, v]) => `${k}=${v}`),
      Labels: { [LABEL]: '1', [DEMO_LABEL]: demo.id, [SESSION_LABEL]: session },
      ExposedPorts: { [`${demo.gatewayPort}/tcp`]: {} },
      HostConfig: {
        PortBindings: { [`${demo.gatewayPort}/tcp`]: [{ HostPort: '' }] }, // '' = ephemeral host port
        AutoRemove: true,
      },
    });
    await container.start();
    const info = await container.inspect();
    const binding = info.NetworkSettings.Ports[`${demo.gatewayPort}/tcp`]?.[0];
    const hostPort = Number(binding?.HostPort);
    if (!hostPort) throw new Error('no host port allocated');
    return {
      id: info.Id.slice(0, 12),
      demo: demo.id,
      session,
      host: `localhost:${hostPort}`,
      hostPort,
      createdAt: Date.now(),
    };
  }

  async stop(id: string): Promise<void> {
    const c = this.#docker.getContainer(id);
    // SIGINT (not SIGTERM): PID 1 (ros2 launch) ignores SIGTERM (verified).
    await c.kill({ signal: 'SIGINT' }).catch(() => {});
    await c.remove({ force: true }).catch(() => {});
  }

  async list(): Promise<Instance[]> {
    const containers = await this.#docker.listContainers({
      filters: { label: [`${LABEL}=1`] },
    });
    return containers.map((c) => {
      const pub = c.Ports.find((p) => p.PublicPort)?.PublicPort ?? 0;
      return {
        id: c.Id.slice(0, 12),
        demo: c.Labels[DEMO_LABEL] ?? 'unknown',
        session: c.Labels[SESSION_LABEL] ?? '',
        host: `localhost:${pub}`,
        hostPort: pub,
        createdAt: c.Created * 1000,
      };
    });
  }
}
