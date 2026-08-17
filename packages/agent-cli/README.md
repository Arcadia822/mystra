# `mystra-agent`

Task-scoped workload CLI for a Mystra TaskExecutionContext. It is deliberately
separate from the Human and automation-facing `mystra` Control Plane CLI.

The Runtime injects only:

- `MYSTRA_CONTROL_PLANE_URL`
- `MYSTRA_EXECUTION_CODE`

Supported commands:

```sh
mystra-agent whoami
mystra-agent context get
mystra-agent task status get
mystra-agent task status set blocked --expected-revision 2 --idempotency-key cmd-1 --note "linctl is unavailable"
mystra-agent task status set in_progress --expected-revision 3 --idempotency-key cmd-2
mystra-agent task status set blocked --expected-revision 4 --idempotency-key cmd-3 --note "Ready for review: PR ...; tests: ..."
```

The CLI never accepts a Task ID. The execution code selects the exact Team,
Task, TaskExecutionContext, Session, Project, and Workspace, plus optional frozen Agent
Context. `whoami` and `context get` return `agentContext: null` when Start did
not select an Agent; otherwise they return the frozen Agent ID, name, and
revision. The execution code identifies the execution context independently of Agent
Context. `context get` adds `workspace.root` from the process working directory;
the Control Plane does not persist a host filesystem path.

Linear requirement reads and GitHub PR delivery remain host-local `linctl` and
`gh` operations. This package does not proxy those tools, issue their
credentials, or verify their outputs.

```sh
corepack pnpm --filter @mystra/agent-cli build
corepack pnpm --filter @mystra/agent-cli test
```
