#!/usr/bin/env node
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pack, packAospkgFromTar } from '@rivet-dev/agentos-toolchain';

const require = createRequire(import.meta.url);
const outputDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/agentos');
const cliDirectory = path.dirname(require.resolve('@tacobin/cli/package.json'));
const cli = JSON.parse(await readFile(path.join(cliDirectory, 'package.json'), 'utf8'));
if (cli.version !== '0.1.3') throw new Error('AgentOS Taco build requires @tacobin/cli 0.1.3');
const skillRevision = '410a425e50bcc10b7c89ad6015c4b67e7dc7d418';
await mkdir(outputDirectory, { recursive: true });
const staging = await mkdtemp(path.join(outputDirectory, '.taco-build-'));
try {
  const skillDirectory = path.join(staging, 'taco-skill');
  await mkdir(skillDirectory);
  // The CLI embeds cloud guidance, not the full offline authoring shell. Fetch the
  // immutable upstream skill at BUILD time; guest Sessions never install or download it.
  for (const file of ['SKILL.md', 'taco-shell.html']) {
    const response = await fetch(`https://raw.githubusercontent.com/Arcadia822/taco/${skillRevision}/skills/taco/${file}`, {
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`Taco skill ${file}: HTTP ${response.status}`);
    await writeFile(path.join(skillDirectory, file), new Uint8Array(await response.arrayBuffer()));
  }
  const result = pack({ source: cliDirectory, out: path.join(staging, 'taco-cli.tar') });
  // core 0.2.19 expects the canonical container header, not the intermediate tar.
  packAospkgFromTar(result.packageTar, path.join(staging, 'taco-cli.aospkg'));
  await rm(path.join(outputDirectory, 'taco-skill'), { recursive: true, force: true });
  await rename(skillDirectory, path.join(outputDirectory, 'taco-skill'));
  await rename(path.join(staging, 'taco-cli.aospkg'), path.join(outputDirectory, 'taco-cli.aospkg'));
  console.log(`AgentOS Taco CLI ${cli.version} and skill ${skillRevision} built in ${outputDirectory}`);
} finally {
  await rm(staging, { recursive: true, force: true });
}
