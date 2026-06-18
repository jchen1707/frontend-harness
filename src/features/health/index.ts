// Public surface of the `health` feature. This is the ONLY entry point other
// features and the app shell may import from — everything under ui/, services/,
// and repositories/ is feature-internal (enforced by eslint-plugin-boundaries).
export { Home } from './ui/Home';
export { useHealth, type UseHealthOptions } from './services/useHealth';
export type { Health } from './repositories/schemas/health';
