import {
  SKILL_MAX_ARCHIVE_BYTES,
  taskExecutionContextPayloadSchema,
  taskStatusTransitionResultSchema,
  taskStatusViewSchema,
  workloadWhoamiSchema,
  taskProductionErrorResponseSchema,
  workflowCurrentResponseSchema,
  workflowTransitionRequestSchema,
  workflowTransitionResponseSchema,
  workflowErrorResponseSchema,
  workflowSkillProjectionReportSchema,
  type AgentTaskStatusSetRequest,
  type TaskExecutionContextPayload,
  type TaskStatusTransitionResult,
  type TaskStatusView,
  type WorkloadWhoami,
  type WorkflowCurrentResponse,
  type WorkflowTransitionRequest,
  type WorkflowTransitionResponse,
  type WorkflowSkillProjectionReport,
} from "@mystra/shared";

export class AgentCliFailure extends Error {
  constructor(readonly code: string, message: string, readonly details?: Readonly<Record<string, unknown>>) {
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

  workflowCurrent(): Promise<WorkflowCurrentResponse> {
    return this.#request("/api/agent-execution/workflow/current", workflowCurrentResponseSchema);
  }

  workflowTransition(request: WorkflowTransitionRequest): Promise<WorkflowTransitionResponse> {
    return this.#request(
      "/api/agent-execution/workflow/transition",
      workflowTransitionResponseSchema,
      workflowTransitionRequestSchema.parse(request),
    );
  }

  async workflowSkillDownload(pathname: string): Promise<Buffer> {
    let response: Response;
    try {
      response = await this.#fetch(new URL(pathname, this.#endpoint), {
        headers: { authorization: `Bearer ${this.#executionCode}` },
      });
    } catch {
      throw new AgentCliFailure("workflow_skill_projection_failed", "Workflow Skill download failed");
    }
    if (!response.ok || !response.body) throw new AgentCliFailure("workflow_skill_projection_failed", "Workflow Skill download failed");
    const declared = Number(response.headers.get("content-length"));
    if (!Number.isSafeInteger(declared) || declared < 1 || declared > SKILL_MAX_ARCHIVE_BYTES) {
      await response.body.cancel();
      throw new AgentCliFailure("workflow_skill_projection_failed", "Workflow Skill archive length is invalid");
    }
    const chunks: Uint8Array[] = [];
    const reader = response.body.getReader();
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > declared || size > SKILL_MAX_ARCHIVE_BYTES) {
        await reader.cancel();
        throw new AgentCliFailure("workflow_skill_projection_failed", "Workflow Skill archive exceeds its bound");
      }
      chunks.push(value);
    }
    if (size !== declared) throw new AgentCliFailure("workflow_skill_projection_failed", "Workflow Skill archive length is invalid");
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), size);
  }

  async workflowSkillReport(report: WorkflowSkillProjectionReport): Promise<boolean> {
    const parsed = workflowSkillProjectionReportSchema.parse(report);
    let response: Response;
    try {
      response = await this.#fetch(new URL("/api/agent-execution/workflow/skills/report", this.#endpoint), {
        method: "POST",
        headers: { authorization: `Bearer ${this.#executionCode}`, "content-type": "application/json" },
        body: JSON.stringify(parsed),
      });
    } catch {
      throw new AgentCliFailure("workflow_skill_projection_failed", "Workflow Skill report failed");
    }
    await response.text();
    if (response.status === 409) return false;
    if (!response.ok) throw new AgentCliFailure("workflow_skill_projection_failed", "Workflow Skill report failed");
    return true;
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
      const workflow = workflowErrorResponseSchema.safeParse(value);
      const parsed = taskProductionErrorResponseSchema.safeParse(value);
      throw new AgentCliFailure(
        workflow.success ? workflow.data.error.code : parsed.success ? parsed.data.error.code : "control_plane_unavailable",
        workflow.success ? workflow.data.error.message : parsed.success ? parsed.data.error.message : "Control Plane request failed",
      );
    }
    try {
      return schema.parse(value);
    } catch {
      throw new AgentCliFailure("control_plane_unavailable", "Control Plane returned an invalid response");
    }
  }
}
