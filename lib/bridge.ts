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

export function connectManualToken(token: string): Promise<SessionStatus> {
  return bridgeFetch<SessionStatus>("/v1/rappi/session/manual", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function disconnectRappi(): Promise<SessionStatus> {
  return bridgeFetch<SessionStatus>("/v1/rappi/session", { method: "DELETE" });
}

export type ChatTurn = { role: "user" | "assistant" | "system"; text: string };

export type DispatchResult = {
  reply: string;
  agent_name: string | null;
  mandate_jti: string | null;
};

export async function askKernel(text: string): Promise<DispatchResult> {
  // Preferred: the kernel routes to the agent whose mandate matches.
  try {
    const response = await fetch(`${KERNEL_URL}/agent/dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (response.ok) {
      const data = (await response.json()) as {
        replies?: string[];
        dispatch?: { agent_name?: string; mandate_jti?: string };
      };
      const reply = data.replies?.join("\n") ?? "";
      return {
        reply,
        agent_name: data.dispatch?.agent_name ?? null,
        mandate_jti: data.dispatch?.mandate_jti ?? null,
      };
    }
    if (response.status !== 404) {
      throw new Error(`kernel /agent/dispatch → ${response.status}`);
    }
  } catch (error) {
    if ((error as Error).message.includes("/agent/dispatch")) throw error;
    // fall through to the pinned-agent path below
  }
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
  const data = (await response.json()) as { replies?: string[] };
  return { reply: data.replies?.join("\n") ?? "", agent_name: null, mandate_jti: null };
}
