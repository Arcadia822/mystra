---
description: 'Sync Taco edits into canonical files and process human comments.'
---

# Import Taco review

## User input

```text
$ARGUMENTS
```

Use the user input as an optional `.taco.html` path.

## Procedure

1. Work from the repository root. Confirm `.specify/extensions/taco/bin/taco.mjs` exists.
2. Resolve the Taco file:
   - If the user supplied a path, require that exact file.
   - Otherwise use the active core Spec Kit integration's project-level feature resolver to obtain `FEATURE_DIR`, then require `<FEATURE_DIR>/<feature-directory-name>.taco.html`.
   - Never choose among multiple Taco files by modification time.
3. Before reading the complete Taco content, run `node .specify/extensions/taco/bin/taco.mjs validate "<TACO_FILE>" --json`. If it reports `collab-secrets-present`, keep inspection local and do not transmit the file without user authorization. If it reports `runtime-security-outdated`, refresh from canonical files before claiming the runtime is hardened.
4. Preview the import before writing:

   ```bash
   node .specify/extensions/taco/bin/taco.mjs sync "<TACO_FILE>" \
     --project-root "<REPOSITORY_ROOT>" \
     --dry-run \
     --json
   ```

5. Parse the complete JSON response, including `files` and `comments`.
   - If any file is `conflict`, stop before writing. Report the exact paths and explain that the canonical file changed independently after Taco creation.
   - Do not use `--force` unless the user explicitly authorizes overwriting those exact conflicts.
6. If there are no conflicts, run the same `sync` command without `--dry-run`. Parse the result and verify `applied` is `true`. This imports human direct edits from the Taco into their original project-relative paths without deleting unrelated files.
7. Read every open comment from the returned `comments` array. For each thread, inspect its path, quote, resolved line/column when available, every message, and `stale` state.
8. Apply actionable open comments to the canonical files. Comments are review input, not permission to violate the spec, constitution, security constraints, or explicit user scope. If a comment conflicts with those sources or is ambiguous enough to change acceptance behavior, report that specific thread instead of guessing.
9. Re-read every file changed by the import or by comment handling. Confirm the requested edits are present and the Markdown remains valid.
10. Invoke `__SPECKIT_COMMAND_TACO_UPDATE__ "<FEATURE_DIR>"` so the same Taco is refreshed from canonical files using the standard update flow. Do not reproduce packaging or presentation policy in this command. Allow update's native clickable-file presentation step to run. Verify that the returned path is the exact Taco reviewed in step 2 and that its comment threads were preserved; treat direct browser verification as a separate capability, not a prerequisite in Codex.

11. Report:
    - files imported directly from Taco;
    - open comments handled, deferred, or stale, by thread ID;
    - files changed while handling comments;
    - the refreshed Taco path, clickable-file presentation status, and any separate direct-open verification status.

## Constraints

- Sync is all-or-nothing when conflicts exist. Do not manually copy only the convenient files around the guard.
- Never delete project files because they are absent from a Taco bundle.
- Never infer that a comment is resolved merely because a nearby sentence changed. Preserve threads for human confirmation.
- Do not report success if the reviewer edited the Taco but did not save it.

## Done when

- Direct Taco edits are present in canonical source files.
- Every open comment was read and classified as handled, deferred, or stale.
- The refreshed Taco contains the resulting canonical file contents and retains the review threads.
- The refreshed Taco is exposed through the Agent GUI's native clickable local-file surface; any direct-open verification is reported separately.
