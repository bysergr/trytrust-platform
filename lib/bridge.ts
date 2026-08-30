// TryTrust platform → Aval Rappi bridge (decision 0030).
// The bridge runs on the credential machine (127.0.0.1); the token never
// leaves it — this client only ever sees masked status labels.

export const BRIDGE_URL =
  process.env.NEXT_PUBLIC_RAPPI_BRIDGE_URL ?? "http://localhost:8010";

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

export type PaymentMethodView = {
  id: string;
  main_description: string | null;
  secondary_description: string | null;
  available: boolean;
  selected: boolean;
  cash: boolean;
};

export function fetchPaymentMethods(): Promise<PaymentMethodView[]> {
  return bridgeFetch<{ methods: PaymentMethodView[] }>(
    "/v1/rappi/payment/methods"
  ).then((data) => data.methods);
}

export function disconnectRappi(): Promise<SessionStatus> {
  return bridgeFetch<SessionStatus>("/v1/rappi/session", { method: "DELETE" });
}
