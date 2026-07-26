---
name: mystra-open-control-plane
description: Check the local Mystra control plane and open its overview, Runner detail, or Task detail in the Codex internal browser.
metadata:
  priority: 5
  promptSignals:
    phrases:
      - "open Mystra"
      - "open control plane"
      - "show runner"
      - "show task in Mystra"
      - "Mystra Web UI"
---

# Mystra Open Control Plane

Use this skill when the user wants to inspect Mystra visually while continuing
to operate it through Codex.

## Inputs

- target: `overview` (default), `runner`, or `task`
- id: required for `runner` and `task`
- optional control-plane URL through `MYSTRA_CONTROL_PLANE_URL`

## Procedure

1. Resolve the plugin root from this `SKILL.md` location, then run the bundled
   script at `<plugin-root>/scripts/control-plane-handoff.mjs`:

   ```sh
   node <plugin-root>/scripts/control-plane-handoff.mjs --target overview
   node <plugin-root>/scripts/control-plane-handoff.mjs --target runner --id RUNNER_ID
   node <plugin-root>/scripts/control-plane-handoff.mjs --target task --id JOB_ID
   ```

2. Parse the JSON result. It must contain:

   ```json
   {
     "browserHandoff": {
       "url": "http://127.0.0.1:3000/...",
       "openStrategy": "codex-internal-browser"
     }
   }
   ```

3. Use the available Codex built-in browser capability to open the exact
   `browserHandoff.url`. Do not reinterpret it as an MCP App, artifact preview,
   or native tab extension.

4. Tell the user which object page was opened. Keep Mystra API/MCP as the source
   of truth; the browser is an operator surface.

## Failure Behavior

- If the script exits non-zero, report its connection or input error and stop.
- Do not silently change the host, port, target, or object id.
- Do not claim the page was opened if the browser capability is unavailable.
- Do not access Linear as part of opening the UI.
