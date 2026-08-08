# Contract Boundary: Future Session Agent Selection

046 does not implement Session persistence or launch. It exposes only the Agent-owned resolution seam required by the future Session contract.

## Four independent execution selections

```ts
type SessionExecutionSelection = {
  runtimeId: string;
  provider: ProviderName;
  agentId: string;
  contextId: string;
};

type OptionalBusinessReferences = {
  projectId?: string; // 0..1, independent
  taskId?: string;    // 0..1, independent
};
```

`projectId` and `taskId` are not execution factors and do not derive one another. Session, Task and Project are Team peers.

## Agent-owned resolver

```ts
resolveActiveAgent(
  agentId: string,
  options: { teamId: string },
): Promise<ResolvedAgentSnapshot | undefined>
```

```ts
type ResolvedAgentSnapshot = {
  agentId: string;
  revision: number;
  systemPrompt: string;
};
```

Rules:

1. Missing or cross-Team Agent resolves as not found.
2. Archived Agent produces `AGENT_ARCHIVED`; it is not selectable.
3. The returned value is a detached immutable snapshot; later Agent changes cannot mutate it.
4. Provider availability is checked against Runtime elsewhere. The resolver neither accepts nor infers Provider.
5. Context assembly is owned elsewhere. The resolver returns no skills, files or tools.
6. Future Session creation must persist this snapshot atomically with its other resolved inputs; execution must not re-read the current Agent.
