import {
  taskExecutionContextPayloadSchema,
  taskStatusTransitionResultSchema,
  taskStatusViewSchema,
  workloadWhoamiSchema,
  taskProductionErrorResponseSchema,
  type AgentTaskStatusSetRequest,
  type TaskExecutionContextPayload,
  type TaskStatusTransitionResult,
  type TaskStatusView,
  type WorkloadWhoami,
} from "@mystra/shared";

export class AgentCliFailure extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

export class AgentExecutionClient {
  readonly #endpoint: URL;
  readonly #executionCode: string;
  readonly #fetch: typeof fetch;

  constructor(input: { endpoint: string; executionCode: string; fetch?: typeof fetch }) {
    try {
      this.#endpoint = new URL(input.endpoint);
    } catch {
      throw new AgentCliFailure("invalid_request", "MYSTRA_CONTROL_PLANE_URL must be an absolute URL");
    }
    if (!input.executionCode.trim()) {
      throw new AgentCliFailure("capability_expired", "MYSTRA_EXECUTION_CODE is required");
    }
    this.#executionCode = input.executionCode;
    this.#fetch = input.fetch ?? fetch;
  }

  whoami(): Promise<WorkloadWhoami> {
    return this.#request("/api/agent-execution/whoami", workloadWhoamiSchema);
  }

  context(): Promise<TaskExecutionContextPayload> {
    return this.#request("/api/agent-execution/context", taskExecutionContextPayloadSchema);
  }

  taskStatus(): Promise<TaskStatusView> {
    return this.#request("/api/agent-execution/task-status", taskStatusViewSchema);
  }

  setTaskStatus(request: AgentTaskStatusSetRequest): Promise<TaskStatusTransitionResult> {
    return this.#request("/api/agent-execution/task-status", taskStatusTransitionResultSchema, request);
  }

  async #request<T>(pathname: string, schema: { parse(value: unknown): T }, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await this.#fetch(new URL(pathname, this.#endpoint), {
        method: body === undefined ? "GET" : "POST",
        headers: {
          authorization: `Bearer ${this.#executionCode}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new AgentCliFailure("control_plane_unavailable", "Control Plane request failed");
    }
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new AgentCliFailure("control_plane_unavailable", "Control Plane returned invalid JSON");
    }
    if (!response.ok) {
      const parsed = taskProductionErrorResponseSchema.safeParse(value);
      throw new AgentCliFailure(
        parsed.success ? parsed.data.error.code : "control_plane_unavailable",
        parsed.success ? parsed.data.error.message : "Control Plane request failed",
      );
    }
    try {
      return schema.parse(value);
    } catch {
      throw new AgentCliFailure("control_plane_unavailable", "Control Plane returned an invalid response");
    }
  }
}
