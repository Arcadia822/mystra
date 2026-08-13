import type { SessionEvent, SessionState } from "@mystra/shared";

import type { ShellLocale } from "./shell-copy";

type PresentableEvent = Pick<SessionEvent, "globalSequence" | "payload" | "occurredAt"> & { kind: string };

export type SessionEventPresentation = {
  title: string;
  detail?: string | undefined;
  tone: "neutral" | "active" | "good" | "warning" | "bad";
};

const activeStates = new Set<SessionState>([
  "queued", "dispatched", "message_pending", "running", "interrupted", "waiting_for_handoff",
]);

export function shouldPollSession(state: SessionState, documentHidden = false): boolean {
  return !documentHidden && activeStates.has(state);
}

export function mergeSessionEvents(current: SessionEvent[], incoming: SessionEvent[]): SessionEvent[] {
  const byId = new Map(current.map((event) => [event.eventId, event]));
  for (const event of incoming) byId.set(event.eventId, event);
  return [...byId.values()].sort((left, right) => left.globalSequence - right.globalSequence);
}

export function sessionStateLabel(state: SessionState, locale: ShellLocale): string {
  const labels: Record<ShellLocale, Record<SessionState, string>> = {
    en: {
      queued: "Queued", dispatched: "Dispatched", message_pending: "Message pending", running: "Running",
      ready: "Response complete · can continue", interrupted: "Interrupted", waiting_for_handoff: "Waiting for handoff",
      closed: "Closed", failed: "Failed",
    },
    "zh-CN": {
      queued: "排队中", dispatched: "已派发", message_pending: "消息待处理", running: "运行中",
      ready: "本次响应完成 · 可继续", interrupted: "已中断", waiting_for_handoff: "等待交接",
      closed: "已关闭", failed: "失败",
    },
  };
  return labels[locale][state];
}

function stringValue(payload: Record<string, unknown>, key: string): string | undefined {
  return typeof payload[key] === "string" ? payload[key] : undefined;
}

function messageText(payload: Record<string, unknown>): string | undefined {
  if (!Array.isArray(payload.content)) return undefined;
  const parts = payload.content.flatMap((part) => (
    part && typeof part === "object" && "type" in part && part.type === "text" && "text" in part && typeof part.text === "string"
      ? [part.text]
      : []
  ));
  return parts.length > 0 ? parts.join("\n") : undefined;
}

function promptEvidenceDetail(payload: Record<string, unknown>, zh: boolean): string | undefined {
  const standard = payload.standardPrompt;
  if (!standard || typeof standard !== "object" || !("version" in standard) || typeof standard.version !== "string") return undefined;
  const agent = payload.agentContext;
  if (agent === null) return `${standard.version} · ${zh ? "无附加 Agent 上下文" : "No optional Agent Context"}`;
  if (agent && typeof agent === "object" && "name" in agent && "revision" in agent && typeof agent.name === "string" && typeof agent.revision === "number") {
    return `${standard.version} · ${agent.name} r${agent.revision}`;
  }
  return standard.version;
}

export function presentSessionEvent(event: PresentableEvent, locale: ShellLocale): SessionEventPresentation {
  const zh = locale === "zh-CN";
  const payload = event.payload as Record<string, unknown>;
  switch (event.kind) {
    case "session.created": return { title: zh ? "Session 已创建" : "Session created", tone: "neutral" };
    case "session.system_prompt_configured": return { title: zh ? "执行指令已配置" : "Execution instructions configured", detail: promptEvidenceDetail(payload, zh), tone: "neutral" };
    case "session.workspace_attached": return { title: zh ? "Task Workspace 已附加" : "Task Workspace attached", detail: zh ? "共享可变目录" : "Shared mutable directory", tone: "neutral" };
    case "session.user_message_submitted": return { title: zh ? "用户消息" : "User message", detail: messageText(payload), tone: "neutral" };
    case "session.runtime_dispatched": return { title: zh ? "已派发到 Runtime" : "Dispatched to Runtime", tone: "active" };
    case "session.provider_started": return { title: zh ? "Provider 已启动" : "Provider started", tone: "active" };
    case "session.response_started": return { title: zh ? "响应开始" : "Response started", tone: "active" };
    case "session.agent_message_chunk": return { title: zh ? "Agent 回复" : "Agent response", detail: stringValue(payload, "text"), tone: "active" };
    case "session.agent_thought_chunk": return { title: zh ? "处理过程" : "Process trace", detail: stringValue(payload, "text"), tone: "neutral" };
    case "session.plan_updated": return { title: zh ? "计划更新" : "Plan updated", detail: stringValue(payload, "plan"), tone: "neutral" };
    case "session.tool_call": return { title: zh ? "工具调用" : "Tool call", detail: stringValue(payload, "name"), tone: "active" };
    case "session.tool_call_updated": return { title: zh ? "工具状态" : "Tool status", detail: stringValue(payload, "status"), tone: stringValue(payload, "status") === "failed" ? "bad" : "neutral" };
    case "session.usage_updated": return { title: zh ? "用量更新" : "Usage updated", detail: typeof payload.totalTokens === "number" ? `${payload.totalTokens} tokens` : undefined, tone: "neutral" };
    case "session.input_requested": return { title: zh ? "需要输入" : "Input requested", detail: stringValue(payload, "prompt"), tone: "warning" };
    case "session.input_received": return { title: zh ? "已收到输入" : "Input received", detail: stringValue(payload, "response"), tone: "neutral" };
    case "session.approval_requested": return { title: zh ? "需要批准" : "Approval requested", detail: stringValue(payload, "description"), tone: "warning" };
    case "session.approval_resolved": return { title: zh ? "批准已处理" : "Approval resolved", detail: stringValue(payload, "decision"), tone: "neutral" };
    case "session.interrupted": return { title: zh ? "执行已中断" : "Execution interrupted", detail: stringValue(payload, "reason"), tone: "warning" };
    case "session.resumed": return { title: zh ? "执行已恢复" : "Execution resumed", tone: "active" };
    case "session.handoff_requested": return { title: zh ? "请求交接" : "Handoff requested", detail: stringValue(payload, "reason"), tone: "warning" };
    case "session.handoff_accepted": return { title: zh ? "交接已接受" : "Handoff accepted", detail: stringValue(payload, "reason"), tone: "active" };
    case "session.handoff_completed": return { title: zh ? "交接已完成" : "Handoff completed", detail: stringValue(payload, "reason"), tone: "good" };
    case "session.response_completed": return { title: zh ? "本次响应完成" : "Response completed", detail: stringValue(payload, "summary"), tone: "good" };
    case "session.response_canceled": return { title: zh ? "本次响应已取消" : "Response canceled", detail: stringValue(payload, "reason"), tone: "warning" };
    case "session.response_failed": return { title: zh ? "本次响应失败" : "Response failed", detail: stringValue(payload, "message"), tone: "bad" };
    case "session.close_requested": return { title: zh ? "请求关闭 Session" : "Session close requested", detail: stringValue(payload, "reason"), tone: "warning" };
    case "session.closed": return { title: zh ? "Session 已关闭" : "Session closed", detail: stringValue(payload, "reason"), tone: "good" };
    case "session.runtime_lost": return { title: zh ? "Runtime 连接丢失" : "Runtime connection lost", detail: stringValue(payload, "message"), tone: "bad" };
    case "session.failed": return { title: zh ? "Session 失败" : "Session failed", detail: stringValue(payload, "message"), tone: "bad" };
    default: return { title: zh ? `未知事件 · ${event.kind}` : `Unknown event · ${event.kind}`, tone: "neutral" };
  }
}
