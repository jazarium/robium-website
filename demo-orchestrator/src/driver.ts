import type { Demo, Instance } from './types.ts';

export interface Driver {
  start(demo: Demo, session: string): Promise<Instance>;
  stop(id: string): Promise<void>;
  list(): Promise<Instance[]>;
}
