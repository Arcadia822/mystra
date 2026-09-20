import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { afterEach, describe, expect, it } from 'vitest';

// @ts-expect-error AgentOS loads this runtime binding as native ESM JavaScript.
import { mystraBinding } from './mystra-binding.mjs';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function executableProbe() {
  const directory = await mkdtemp(path.join(tmpdir(), 'mystra-binding-'));
  temporaryDirectories.push(directory);
  const executable = path.join(directory, 'probe.mjs');
  await writeFile(executable, `#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd(), workspaceRoot: process.env.MYSTRA_WORKSPACE_ROOT }) + "\\n");\n`);
  await chmod(executable, 0o700);
  return { directory, executable };
}

function binding(agentPath: string, workspaceDirectory: string) {
  return mystraBinding({
    agentPath,
    controlPlaneUrl: 'https://control.example.test',
    executionCode: 'session-secret',
    capabilities: ['context:read', 'workflow:transition'],
    workspaceDirectory,
    guestWorkspaceDirectory: '/home/agentos/workspace',
  }).bindings.run;
}

describe('mystraBinding', () => {
  it('permits only the documented workflow transition grammar and projects the guest workspace root', async () => {
    const probe = await executableProbe();
    const run = binding(probe.executable, probe.directory);

    const result = await run.execute({
      args: ['workflow', 'transition', 'implementation-complete', '--expected-revision', '2', '--json'],
    });
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      args: ['workflow', 'transition', 'implementation-complete', '--expected-revision', '2', '--json'],
      workspaceRoot: '/home/agentos/workspace',
    });

    await expect(run.execute({
      args: ['workflow', 'transition', '--expected-revision', '2'],
    })).rejects.toThrow('Workflow transition is malformed');
  });

  it('decodes a binding envelope from stdin beyond the Linux single-argument limit', () => {
    const decoder = fileURLToPath(new URL('./guest-bin/mystra-agent-decode.js', import.meta.url));
    const stdout = 'x'.repeat(200_000);
    const result = spawnSync(process.execPath, [decoder], {
      input: JSON.stringify({ ok: true, result: { exitCode: 0, stdout, stderr: '' } }),
      encoding: 'utf8',
      maxBuffer: 1_000_000,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(stdout);
    expect(result.stderr).toBe('');
  });
});
