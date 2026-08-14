---
name: gitnexus-cli
description: "Use when the user needs to run GitNexus CLI commands like analyze/index a repo, check status, clean the index, generate a wiki, or list indexed repos. Examples: \"Index this repo\", \"Reanalyze the codebase\", \"Generate a wiki\""
---

# GitNexus CLI Commands

Mystra pins GitNexus in the root workspace. Run it only through the repository
scripts or `pnpm exec gitnexus`; do not use a global binary, `npx`, `pnpm dlx`,
or the generated `.gitnexus/run.cjs` wrapper. Those entry points can resolve a
different GitNexus/LadybugDB pair and make one index appear both current and
stale.

## Version Compatibility and Recovery

1. Run `npm view gitnexus dist-tags --json` before changing the pin. Prefer the
   newest stable `latest` version. Use a release candidate only if stable cannot
   repair the exact failure and the RC passes every verification step below.
2. Keep `package.json` and `pnpm-lock.yaml` on one exact GitNexus version. The
   index writer and MCP reader must use that same dependency line.
3. Treat `Database file version: X, Current build storage version: Y` as a
   writer/reader version split. Do not call the graph corrupt and do not trust
   impact output from the incompatible reader.
4. If `lbugjs.node` is missing, run the pinned `pnpm install` and confirm
   `pnpm gitnexus:doctor`. Do not introduce another global, `npx`, or `dlx`
   version as a workaround.
5. After installation or a version change, stop only the MCP process serving
   this repository, run `pnpm gitnexus:rebuild`, verify status and CLI queries,
   then restart the MCP client and repeat the MCP smoke check. Do not rebuild
   while another process owns `.gitnexus/lbug`.

## Commands

### analyze — Build or refresh the index

```bash
pnpm gitnexus:analyze
```

Run from the project root. This parses source files, builds the knowledge graph,
and writes it to `.gitnexus/`. Mystra deliberately uses `--index-only` so an
index refresh cannot replace project-local skills or the curated GitNexus block
in `AGENTS.md`.

| Flag | Effect |
|------|--------|
| `pnpm gitnexus:rebuild` | Force a full index-only rebuild |
| `--embeddings` | Enable embedding generation for semantic search (off by default) |
| `--drop-embeddings` | Drop existing embeddings on rebuild. By default, an `analyze` without `--embeddings` preserves them. |

**When to run:** First time in a project, after major code changes, or when `gitnexus://repo/{name}/context` reports the index is stale.

### status — Check index freshness

```bash
pnpm gitnexus:status
```

Shows whether the current repo has a GitNexus index, when it was last updated, and symbol/relationship counts. Use this to check if re-indexing is needed.

### clean — Delete the index

```bash
pnpm exec gitnexus clean
```

Deletes the `.gitnexus/` directory and unregisters the repo from the global registry. Use before re-indexing if the index is corrupt or after removing GitNexus from a project.

| Flag | Effect |
|------|--------|
| `--force` | Skip confirmation prompt |
| `--all` | Clean all indexed repos, not just the current one |

### wiki — Generate documentation from the graph

```bash
pnpm exec gitnexus wiki
```

Generates repository documentation from the knowledge graph using an LLM. Requires an API key (saved to `~/.gitnexus/config.json` on first use).

| Flag | Effect |
|------|--------|
| `--force` | Force full regeneration |
| `--model <model>` | LLM model (default: minimax/minimax-m2.5) |
| `--base-url <url>` | LLM API base URL |
| `--api-key <key>` | LLM API key |
| `--concurrency <n>` | Parallel LLM calls (default: 3) |
| `--gist` | Publish wiki as a public GitHub Gist |

### list — Show all indexed repos

```bash
pnpm exec gitnexus list
```

Lists all repositories registered in `~/.gitnexus/registry.json`. The MCP `list_repos` tool provides the same information.

## After Indexing

1. Run `pnpm gitnexus:doctor` and require the LadybugDB native binary to load.
2. Run `pnpm gitnexus:status` and require the indexed commit to match `HEAD`.
3. **Read `gitnexus://repo/mystra/context`** to verify the MCP loaded the same index.
4. Run one `query`, `context`, `impact`, `cypher`, and `detect_changes` smoke check with `repo: "mystra"`.
5. Use the other GitNexus skills (`exploring`, `debugging`, `impact-analysis`, `refactoring`) for your task.

## Troubleshooting

- **"Not inside a git repository"**: Run from a directory inside a git repo
- **Index is stale after re-analyzing**: confirm `pnpm gitnexus:status`, then restart the MCP client so it loads the pinned global server version.
- **`gitnexus.json` and `meta.json` disagree**: run `pnpm gitnexus:rebuild`; do not copy either metadata file over the other by hand.
- **LadybugDB native binary is missing**: run `pnpm install`, then `pnpm gitnexus:doctor`. The root `onlyBuiltDependencies` allowlist owns the required lifecycle scripts.
- **Embeddings slow**: Omit `--embeddings` (it's off by default) or set `OPENAI_API_KEY` for faster API-based embedding
