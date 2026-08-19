/**
 * The MCP servers this repo defines, and the settings that enable them.
 *
 * Kept apart from `harness.test.mjs` for one reason: that file asserts about the Codex
 * adapter, the generator manifest and the vendored hooks, none of which `main` carries, so
 * it is dropped there. `.mcp.json` and `.claude/settings.json` are on both branches, and a
 * server enabled but not defined resolves to nothing on either.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The MCP configuration.
 */
describe('mcp configuration', () => {
  const mcp = JSON.parse(readFileSync(join(repositoryRoot, '.mcp.json'), 'utf8'));

  it('starts Docker MCP Toolkit for Linear', () => {
    expect(mcp.mcpServers['docker-toolkit']).toEqual({
      command: 'docker',
      args: ['mcp', 'gateway', 'run'],
    });
    expect(JSON.stringify(mcp)).not.toContain('LINEAR_API_KEY');
  });

  // harness:agnostic
  it('gives Codex the same Docker MCP Toolkit command', () => {
    const config = readFileSync(join(repositoryRoot, '.codex', 'config.toml'), 'utf8');
    expect(config).toContain('[mcp_servers.docker_toolkit]');
    expect(config).toContain('args = ["mcp", "gateway", "run"]');
    expect(config).not.toContain('LINEAR_API_KEY');
  });

  it('gives Codex the hardened Chrome DevTools server', () => {
    const config = readFileSync(join(repositoryRoot, '.codex', 'config.toml'), 'utf8');
    const chrome = mcp.mcpServers['chrome-devtools'];
    expect(config).toContain('[mcp_servers.chrome_devtools]');
    expect(config).toContain(`command = "${chrome.command}"`);
    for (const argument of chrome.args) {
      expect(config).toContain(`"${argument}"`);
    }
  });
  // /harness:agnostic

  // The server was renamed in `.mcp.json` while `enabledMcpjsonServers` still named the
  // old one, so the gateway was configured and never enabled. Neither file is wrong on
  // its own; only the pair is.
  it('enables exactly the servers it defines', () => {
    const settings = JSON.parse(
      readFileSync(join(repositoryRoot, '.claude', 'settings.json'), 'utf8'),
    );
    expect([...settings.enabledMcpjsonServers].sort()).toEqual(Object.keys(mcp.mcpServers).sort());
  });
});
