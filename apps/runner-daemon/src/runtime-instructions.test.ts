import { describe, expect, it } from "vitest";

import {
  RUNTIME_WORKLOAD_INSTRUCTIONS,
  resolveRuntimeWorkloadInstruction,
} from "./runtime-instructions.js";

describe("runtime-instructions", () => {
  it("exports non-empty instructions for both host and agentos", () => {
    expect(RUNTIME_WORKLOAD_INSTRUCTIONS.host).toBeTruthy();
    expect(RUNTIME_WORKLOAD_INSTRUCTIONS.agentos).toBeTruthy();
    expect(RUNTIME_WORKLOAD_INSTRUCTIONS.host.length).toBeGreaterThan(20);
    expect(RUNTIME_WORKLOAD_INSTRUCTIONS.agentos.length).toBeGreaterThan(20);
  });

  it("ensures agentos uses the node prefix while host does not", () => {
    const hostInstruction = resolveRuntimeWorkloadInstruction("host");
    const agentosInstruction = resolveRuntimeWorkloadInstruction("agentos");

    // agentos uses node prefix for CLI commands
    expect(agentosInstruction).toContain('node "$MYSTRA_AGENT_PATH" context get');
    expect(agentosInstruction).toContain('node "$MYSTRA_AGENT_PATH" task status get');
    expect(agentosInstruction).toContain('node "$MYSTRA_AGENT_PATH" task status set');
    expect(agentosInstruction).toContain('node "$MYSTRA_AGENT_PATH" workflow current');
    expect(agentosInstruction).toContain('node "$MYSTRA_AGENT_PATH" workflow transition');

    // host executes directly without node prefix
    expect(hostInstruction).toContain('"$MYSTRA_AGENT_PATH" context get');
    expect(hostInstruction).toContain('"$MYSTRA_AGENT_PATH" task status get');
    expect(hostInstruction).toContain('"$MYSTRA_AGENT_PATH" task status set');
    expect(hostInstruction).toContain('"$MYSTRA_AGENT_PATH" workflow current');
    expect(hostInstruction).toContain('"$MYSTRA_AGENT_PATH" workflow transition');

    expect(hostInstruction).not.toContain('node "$MYSTRA_AGENT_PATH"');
  });

  it("includes the rule forbidding building or invoking a Workspace copy of mystra-agent", () => {
    expect(RUNTIME_WORKLOAD_INSTRUCTIONS.host).toContain("Do not build or invoke a Workspace copy of mystra-agent.");
    expect(RUNTIME_WORKLOAD_INSTRUCTIONS.agentos).toContain("Do not build or invoke a Workspace copy of mystra-agent.");
  });

  it("throws for unsupported runtime types", () => {
    // @ts-expect-error testing invalid runtime type
    expect(() => resolveRuntimeWorkloadInstruction("invalid")).toThrow(/Unknown runtime type/);
  });
});
