import { describe, expect, it } from "vitest";

import { validateSkillZip } from "../../apps/control-plane/src/lib/skills/skill-zip-validator";
import {
  buildSkillZip,
  publishPresets,
  readAgentPresets,
  readSkillPresets,
} from "../publish-presets.mjs";

const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("Mystra flow presets", () => {
  it("ships the two Agent Profiles with their责任断言 intact", () => {
    const agents = readAgentPresets() as { name: string; systemPrompt: string }[];
    expect(agents.map((agent) => agent.name)).toEqual(["coordinator", "requirement-designer"]);

    const coordinator = agents.find((agent) => agent.name === "coordinator")!.systemPrompt;
    expect(coordinator).toContain("严格禁止");
    expect(coordinator).toContain("mystra-flow");
    expect(coordinator).toContain("mystra_start_task_production");

    const designer = agents.find((agent) => agent.name === "requirement-designer")!.systemPrompt;
    expect(designer).toContain("Draft PR");
    expect(designer).toContain("taco-cli publish");
    expect(designer).toContain("In Review");
  });

  it("ships a mystra-flow Skill that the canonical validator accepts", async () => {
    const skills = readSkillPresets() as { name: string; files: { path: string; content: Buffer }[] }[];
    expect(skills.map((skill) => skill.name)).toEqual(["mystra-flow"]);

    const validated = await validateSkillZip(buildSkillZip(skills[0]!.files));
    expect(validated.name).toBe("mystra-flow");
    expect(validated.manifest.map((entry) => entry.path)).toEqual(["SKILL.md"]);
  });

  it("keeps every Agent Profile name a valid Skill-style slug and prompt within limits", () => {
    for (const agent of readAgentPresets() as { name: string; systemPrompt: string }[]) {
      expect(agent.name).toMatch(SKILL_NAME_PATTERN);
      expect(agent.systemPrompt.trim().length).toBeGreaterThan(0);
      expect(agent.systemPrompt.length).toBeLessThanOrEqual(32_768);
    }
  });

  it("names the concrete MCP capability each flow step depends on", () => {
    const skill = (readSkillPresets() as { files: { path: string; content: Buffer }[] }[])
      .flatMap((entry) => entry.files)
      .find((file) => file.path === "SKILL.md")!;
    const text = skill.content.toString("utf8");
    for (const tool of [
      "mystra_list_agents",
      "mystra_create_task",
      "mystra_start_task_production",
      "mystra_list_task_sessions",
      "mystra_get_session",
      "mystra_send_session_message",
    ]) {
      expect(text).toContain(tool);
    }
  });

  it("publishes only the presets that changed, and re-publishes an edited Skill", async () => {
    const calls: { url: string; method: string }[] = [];
    const agent = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "coordinator",
      revision: 2,
      systemPrompt: "different",
    };
    const skill = {
      id: "22222222-2222-4222-8222-222222222222",
      name: "mystra-flow",
      resourceRevision: 3,
      currentRevision: { sequence: 1, manifest: [{ path: "SKILL.md", sizeBytes: 1, sha256: "0".repeat(64) }] },
    };

    const fetchImpl = async (url: URL, init?: { method?: string; body?: unknown }) => {
      const method = init?.method ?? "GET";
      calls.push({ url: `${url.pathname}${url.search}`, method });
      if (url.pathname === "/api/agents" && method === "GET") return json({ agents: [agent] });
      if (url.pathname === "/api/agents" && method === "POST") {
        const proposed = JSON.parse(String(init?.body)) as { name: string };
        return json({ agent: { ...agent, id: "33333333-3333-4333-8333-333333333333", name: proposed.name } });
      }
      if (url.pathname.startsWith("/api/agents/")) return json({ agent: { ...agent, systemPrompt: "updated" } });
      if (url.pathname === "/api/skills") return json({ items: [skill] });
      return json({ skill, revision: { sequence: 2 } });
    };

    const report = await publishPresets({
      fetchImpl: fetchImpl as never,
      sessionStore: { read: async () => ({ controlPlaneUrl: "https://control.example.test", sessionToken: "t" }) } as never,
    }) as { agents: { outcome: string }[]; skills: { outcome: string }[] };

    expect(report.agents.filter((entry) => entry.outcome === "updated")).toHaveLength(1);
    expect(report.skills).toEqual([{ name: "mystra-flow", id: skill.id, revision: 2, outcome: "published" }]);
    expect(calls).toContainEqual({ url: "/api/skills/22222222-2222-4222-8222-222222222222/revisions", method: "POST" });
  });

  it("publishes one section without touching the other, and rejects an unknown section", async () => {
    const paths: string[] = [];
    const fetchImpl = async (url: URL, init?: { method?: string }) => {
      paths.push(url.pathname);
      if (url.pathname === "/api/skills" && init?.method === "POST") {
        return json({ skill: { id: "44444444-4444-4444-8444-444444444444" }, revision: { sequence: 1 } });
      }
      if (url.pathname === "/api/agents" && init?.method === "POST") {
        return json({ agent: { id: "55555555-5555-4555-8555-555555555555" } });
      }
      return json({ agents: [], items: [] });
    };
    const sessionStore = {
      read: async () => ({ controlPlaneUrl: "https://control.example.test", sessionToken: "t" }),
    } as never;

    const skillOnly = await publishPresets({ fetchImpl: fetchImpl as never, sessionStore, only: "skills" }) as {
      agents: unknown[]; skills: unknown[];
    };
    expect(skillOnly.agents).toEqual([]);
    expect(paths.some((entry) => entry.startsWith("/api/skills"))).toBe(true);
    expect(paths).not.toContain("/api/agents");

    paths.length = 0;
    const agentOnly = await publishPresets({ fetchImpl: fetchImpl as never, sessionStore, only: "agents" }) as {
      agents: unknown[]; skills: unknown[];
    };
    expect(agentOnly.skills).toEqual([]);
    expect(paths).toContain("/api/agents");
    expect(paths.some((entry) => entry.startsWith("/api/skills"))).toBe(false);

    await expect(publishPresets({
      fetchImpl: fetchImpl as never,
      sessionStore,
      only: "everything",
    })).rejects.toThrow(/Unsupported preset section/u);
  });
});
