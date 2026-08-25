import { Readable } from "node:stream";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";
import { createWorkflowSkillDeliveryService } from "@/lib/workflows/workflow-skill-delivery-service-factory";
import { createWorkflowSkillExecutionDeliveryService } from "@/lib/workflows/workflow-skill-execution-delivery-service-factory";
import { GET as runnerDownload } from "./runner/sessions/[sessionId]/skills/[skillId]/revisions/[revisionId]/download/route";
import { POST as runnerReport } from "./runner/sessions/[sessionId]/skills/report/route";
import { GET as executionDownload } from "./agent-execution/workflow/skills/[skillId]/revisions/[revisionId]/download/route";
import { POST as executionReport } from "./agent-execution/workflow/skills/report/route";

vi.mock("@/lib/db", () => ({ getDb: vi.fn() }));
vi.mock("@/lib/workflows/workflow-skill-delivery-service-factory", () => ({ createWorkflowSkillDeliveryService: vi.fn() }));
vi.mock("@/lib/workflows/workflow-skill-execution-delivery-service-factory", () => ({ createWorkflowSkillExecutionDeliveryService: vi.fn() }));

const sessionId = "00000000-0000-4000-8000-000000000001";
const skillId = "00000000-0000-4000-8000-000000000002";
const revisionId = "00000000-0000-4000-8000-000000000003";
const teamId = "00000000-0000-4000-8000-000000000004";
const workspaceId = "00000000-0000-4000-8000-000000000005";
const zipSha256 = "a".repeat(64);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDb).mockResolvedValue({} as never);
});

function download() {
  return {
    skill: { name: "fixed-skill" }, revision: { zipSha256, sequence: 1 },
    body: Readable.from(Buffer.from("zip")), contentLength: 3,
  };
}

describe("Workflow Skill projection routes", () => {
  it("streams Runner content only through lease-scoped service input and never emits object identity", async () => {
    const service = { download: vi.fn(async () => download()), report: vi.fn() };
    vi.mocked(createWorkflowSkillDeliveryService).mockResolvedValue(service as never);
    const response = await runnerDownload(new Request("http://localhost/download", { headers: {
      "x-mystra-team-id": teamId, "x-mystra-lease-token": "l".repeat(32),
    } }), { params: Promise.resolve({ sessionId, skillId, revisionId }) });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("zip");
    expect(service.download).toHaveBeenCalledWith({ sessionId, teamId, leaseToken: "l".repeat(32), skillId, revisionId });
    expect(JSON.stringify([...response.headers])).not.toContain("objectKey");

    const denied = await runnerDownload(new Request("http://localhost/download"), { params: Promise.resolve({ sessionId, skillId, revisionId }) });
    expect(denied.status).toBe(403);
  });

  it("keeps Runner and execution reports independently scoped and preserves stale-generation rejection", async () => {
    const report = { workspaceId, generation: 2, results: [{ skillId, status: "ready", failureCode: null }] };
    const leaseService = { download: vi.fn(), report: vi.fn(async () => ({ accepted: false, report })) };
    vi.mocked(createWorkflowSkillDeliveryService).mockResolvedValue(leaseService as never);
    const leaseResponse = await runnerReport(new Request("http://localhost/report", {
      method: "POST", headers: { "x-mystra-team-id": teamId, "x-mystra-lease-token": "l".repeat(32) }, body: JSON.stringify(report),
    }), { params: Promise.resolve({ sessionId }) });
    expect(leaseResponse.status).toBe(409);

    const executionService = { download: vi.fn(async () => download()), report: vi.fn(async () => ({ accepted: true, report })) };
    vi.mocked(createWorkflowSkillExecutionDeliveryService).mockResolvedValue(executionService as never);
    const binary = await executionDownload(new Request("http://localhost/download", { headers: { authorization: "Bearer execution-code" } }), {
      params: Promise.resolve({ skillId, revisionId }),
    });
    expect(binary.status).toBe(200);
    expect(executionService.download).toHaveBeenCalledWith({ code: "execution-code", skillId, revisionId });
    const reported = await executionReport(new Request("http://localhost/report", {
      method: "POST", headers: { authorization: "Bearer execution-code" }, body: JSON.stringify(report),
    }));
    expect(reported.status).toBe(200);
    expect(executionService.report).toHaveBeenCalledWith({ code: "execution-code", report });
  });
});
