import { builtinEnvironments, type Environment, type EnvironmentReturn } from 'vitest/environments';

const nodeAbortController = globalThis.AbortController;
const nodeAbortSignal = globalThis.AbortSignal;

const environment: Environment = {
  ...builtinEnvironments.jsdom,
  name: 'jsdom-with-node-abort',
  async setup(
    global: typeof globalThis,
    options: Record<string, unknown>,
  ): Promise<EnvironmentReturn> {
    const result = await builtinEnvironments.jsdom.setup(global, options);

    global.AbortController = nodeAbortController;
    global.AbortSignal = nodeAbortSignal;

    return result;
  },
};

export default environment;
