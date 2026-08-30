// TryTrust platform → Aval Rappi bridge (decision 0030).
// The bridge runs on the credential machine (127.0.0.1); the token never
// leaves it — this client only ever sees masked status labels.

export const BRIDGE_URL =
  process.env.NEXT_PUBLIC_RAPPI_BRIDGE_URL ?? "http://localhost:8010";

export const KERNEL_URL = process.env.NEXT_PUBLIC_KERNEL_URL ?? "";

export type SessionStatus = {
  state: "idle" | "waiting_login" | "captured" | "error";
  has_token: boolean;
  account_label: string | null;
  address_label: string | null;
  error: string | null;
  started_at: string | null;
};

async function bridgeFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BRIDGE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string; reason?: string };
    throw new Error(body.message || body.reason || `bridge ${path} → ${response.status}`);
  }
  return (await response.json()) as T;
}

export function fetchSessionStatus(): Promise<SessionStatus> {
  return bridgeFetch<SessionStatus>("/v1/rappi/session/status");
}

export function startRappiLogin(): Promise<SessionStatus> {
  return bridgeFetch<SessionStatus>("/v1/rappi/session/login", { method: "POST" });
}

export function disconnectRappi(): Promise<SessionStatus> {
  return bridgeFetch<SessionStatus>("/v1/rappi/session", { method: "DELETE" });
}

export type ChatTurn = { role: "user" | "assistant" | "system"; text: string };

export async function askKernel(text: string): Promise<string> {
  const response = await fetch(`${KERNEL_URL}/agent/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      agent_id: process.env.NEXT_PUBLIC_AGENT_ID ?? "aval",
      mandate_jti: process.env.NEXT_PUBLIC_MANDATE_JTI ?? "",
    }),
  });
  if (!response.ok) {
    throw new Error(`kernel /agent/ask → ${response.status}`);
  }
  const data = (await response.json()) as { reply?: string; message?: string };
  return data.reply ?? data.message ?? JSON.stringify(data);
}
