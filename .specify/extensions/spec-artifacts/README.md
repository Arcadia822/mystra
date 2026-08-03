# Spec Artifacts Extension

Generates owner-facing presentation artifacts beside standard Spec-Kit feature
documents:

- `features.md`
- `checklists.md`

These files are derived from the whole feature context and complete `spec.md`.
They do not replace `spec.md`, `plan.md`, `tasks.md`, or
`checklists/requirements.md`.

Use:

```sh
/speckit.spec-artifacts.generate --feature <feature-name>
```

The command is prompt-driven. It must not parse `spec.md` headings or normalize
the standard Spec-Kit artifacts.
