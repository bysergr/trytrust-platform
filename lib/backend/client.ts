import type {
  AgentAuditEvent,
  AgentChainVerification,
  AgentEscalation,
  AgentMandate,
  AgentWatch,
  AuditEvent,
  Mandate,
} from "@/lib/types"

const kernelUrl = () => process.env.KERNEL_API_URL?.replace(/\/$/, "")

async function kernelFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = kernelUrl()
  if (!base) throw new Error("KERNEL_NOT_CONFIGURED")
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(process.env.KERNEL_SERVICE_TOKEN ? { Authorization: `Bearer ${process.env.KERNEL_SERVICE_TOKEN}` } : {}),
      ...init?.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  })
  if (!response.ok) throw new Error(`Kernel ${path} failed (${response.status})`)
  return response.json() as Promise<T>
}

export async function kernelPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  return kernelFetch<T>(path, { method: "POST", body: JSON.stringify(body) })
}

export async function getMandates(userId: string): Promise<Mandate[]> {
  if (!kernelUrl()) {
    if (process.env.NODE_ENV === "production") throw new Error("KERNEL_NOT_CONFIGURED")
    return [{ mandate_id: "mdt_demo", id: "mdt_demo", jti: "mdt_demo_active", status: "active", user_id: userId }]
  }
  return kernelFetch(`/mandates?user_id=${encodeURIComponent(userId)}`)
}

export async function getActiveMandate(userId: string) {
  const mandates = await getMandates(userId)
  return mandates.find((mandate) => mandate.status.toLowerCase() === "active") ?? null
}

/**
 * Chat is scoped to the agent selected by DEFAULT_AGENT_ID, so its turns must
 * use the mandate registered in the kernel's agent lane. Hanko user ids belong
 * to the web application and are not kernel owner ids; looking a mandate up by
 * the Hanko id incorrectly sent first-time users into mandate onboarding.
 *
 * The local demo adapter has no agent lane, so it keeps using its in-memory
 * active mandate.
 */
export async function getConversationMandate(userId: string) {
  if (!kernelUrl()) return getActiveMandate(userId)
  const mandate = await getAgentMandate()
  return mandate.status.toLowerCase() === "active" ? mandate : null
}

/** Read the same audit lane used by the configured conversation agent. */
export async function getConversationAudit(userId: string): Promise<AuditEvent[]> {
  if (kernelUrl()) return getAgentAudit(1_000)
  const mandates = await getMandates(userId)
  return (await Promise.all(mandates.map((mandate) => getAuditEvents(mandate)))).flat()
}

export async function askAgent(input: { text: string; sessionId?: string; agentId: string; mandateJti: string; person: string }) {
  if (!kernelUrl()) {
    if (process.env.NODE_ENV === "production") throw new Error("KERNEL_NOT_CONFIGURED")
    return mockAgentResponse(input.text, input.sessionId)
  }
  return kernelFetch<Record<string, unknown>>("/agent/ask", {
    method: "POST",
    body: JSON.stringify({ text: input.text, agent_id: input.agentId, mandate_jti: input.mandateJti, session_id: input.sessionId, person: input.person }),
  })
}

/**
 * Start a buyer conversation through the kernel's deterministic dispatcher.
 * The browser only supplies the request; the kernel chooses the active agent
 * and its mandate (for example, the Rappi-scoped agent) from its own store.
 */
export async function dispatchAgent(input: { text: string; person: string }) {
  if (!kernelUrl()) {
    if (process.env.NODE_ENV === "production") throw new Error("KERNEL_NOT_CONFIGURED")
    return {
      ...mockAgentResponse(input.text),
      dispatch: {
        agent_id: process.env.DEFAULT_AGENT_ID ?? "agt_flights",
        mandate_jti: "mdt_demo_active",
      },
    }
  }
  return kernelFetch<Record<string, unknown>>("/agent/dispatch", {
    method: "POST",
    body: JSON.stringify({ text: input.text, person: input.person }),
  })
}

export async function getTranscript(sessionId: string) {
  return kernelFetch<Array<{ role: string; text: string; created_at: string }>>(`/agent/transcript?session_id=${encodeURIComponent(sessionId)}`)
}

export async function getAgentRuns(sessionId: string) {
  return kernelFetch<Array<Record<string, unknown>>>(`/agent/runs?session_id=${encodeURIComponent(sessionId)}&limit=50`)
}

export async function getAuditEvents(mandate: Mandate): Promise<AuditEvent[]> {
  if (!kernelUrl()) {
    if (process.env.NODE_ENV === "production") throw new Error("KERNEL_NOT_CONFIGURED")
    return mockAuditEvents(mandate.jti)
  }
  const id = mandate.mandate_id ?? mandate.id ?? mandate.jti
  return kernelFetch(`/audit/events?mandate_id=${encodeURIComponent(id)}&limit=1000`)
}

// ── the agent lane ───────────────────────────────────────────────────────────
// `/agent/*` reads a different store from `/mandates` and `/audit/events`: the
// kernel lane keeps a registry, the agent lane keeps its own tables. That is
// why none of these take a jti from `getActiveMandate` — they let the kernel
// resolve the mandate the agent actually spends under, the same fallback
// `/agent/ask` applies to an id it does not recognise.

export async function getAgentMandate(): Promise<AgentMandate> {
  return kernelFetch("/agent/mandate")
}

export async function getPendingEscalations(): Promise<AgentEscalation[]> {
  return kernelFetch("/agent/escalations")
}

export async function getAgentAudit(limit: number): Promise<AgentAuditEvent[]> {
  return kernelFetch(`/agent/audit?limit=${limit}`)
}

export async function verifyAgentChain(): Promise<AgentChainVerification> {
  return kernelFetch("/agent/verify")
}

export async function getAgentLimits(): Promise<Record<string, unknown>> {
  return kernelFetch("/agent/limits")
}

export async function getWatches(): Promise<AgentWatch[]> {
  return kernelFetch("/agent/watches?status=active")
}

/**
 * The threshold is composed here, from a number, rather than accepted from the
 * caller: a watch buys while nobody is watching, and JsonLogic the browser
 * wrote is not something to hand a poller.
 */
export async function createWatch(input: { maxPrice: number; query: Record<string, string> }) {
  const { agentId, mandateJti, ownerId } = await agentIdentity()
  return kernelPost<{ watch_id: string; threshold: string }>("/agent/watches", {
    agent_id: agentId,
    mandate_jti: mandateJti,
    query: input.query,
    max_price: input.maxPrice,
    autobuy: true,
    created_by: ownerId,
  })
}

type AgentIdentity = { agentId: string; mandateJti: string; ownerId: string }

let identity: AgentIdentity | null = null
let identityAt = 0

/**
 * `/agent/ask` resolves an agent name or an unknown jti for itself, but
 * `/agent/watches` writes what it is handed: a watch created against a name
 * would never fire, and `created_by` is a foreign key into `people`. Cached
 * briefly — re-seeding the kernel is a normal thing to do in development.
 */
async function agentIdentity(): Promise<AgentIdentity> {
  if (identity && Date.now() - identityAt < 60_000) return identity
  const [agents, mandate] = await Promise.all([
    kernelFetch<Array<{ id: string; name: string; owner_id: string }>>("/agent/agents"),
    getAgentMandate(),
  ])
  const wanted = process.env.DEFAULT_AGENT_ID ?? "agt_flights"
  const agent = agents.find((a) => a.id === wanted || a.name === wanted) ?? agents[0]
  if (!agent) throw new Error("KERNEL_NOT_SEEDED")
  identity = { agentId: agent.id, mandateJti: mandate.jti, ownerId: agent.owner_id }
  identityAt = Date.now()
  return identity
}

function mockAgentResponse(text: string, sessionId?: string) {
  const wantsDashboard = /dashboard|transactions|analytics|report/i.test(text)
  const proposal = wantsDashboard ? { source: "gemini-demo", title: "Transaction intelligence dashboard", why: "A concise live view of mandate activity" } : { source: "gemini-demo", offer_id: "ofr_bog_mia_142", title: "VuelaYa BOG → MIA", price: "142.00", currency: "USD", why: "Lowest eligible direct flight" }
  const replies = wantsDashboard
    ? ["I prepared a live transaction dashboard using your permissioned activity."]
    : ["I found a direct VuelaYa flight from Bogotá to Miami for $142 USD. It is within your active mandate and ready for review."]
  return { session_id: sessionId ?? `ses_${crypto.randomUUID().slice(0, 12)}`, replies, run: { run_id: `run_${crypto.randomUUID().slice(0, 12)}`, status: "done", node: "receipt", proposal, result: { status: "captured", receipt: { receipt_id: "rcp_demo_204", title: proposal.title, amount: "142.00", currency: "USD", merchant_id: "vuelaya" } } }, awaiting_human: false }
}

function mockAuditEvents(jti: string): AuditEvent[] {
  const merchants = ["VuelaYa", "Mami Market", "VuelaYa", "Nauta Travel", "VuelaYa", "Mami Market"]
  return Array.from({ length: 18 }, (_, index) => {
    const id = `pur_demo_${index + 1}`
    const date = new Date(Date.now() - (17 - index) * 86_400_000).toISOString()
    const amount = 48 + ((index * 37) % 190)
    const status = index % 7 === 0 ? "rejected" : index % 9 === 0 ? "escalated" : "captured"
    return {
      seq: index + 1, mandate_jti: jti, type: `purchase.${status}`, created_at: date,
      payload: status === "captured"
        ? { purchase_id: id, receipt: { receipt_id: `rcp_${index}`, amount: amount.toFixed(2), currency: "USD", merchant_id: merchants[index % merchants.length], title: index % 2 ? "Flight reservation" : "Everyday purchase" } }
        : { purchase_id: id, amount: amount.toFixed(2), currency: "USD", merchant_id: merchants[index % merchants.length], offer_id: `offer_${index}`, reason_code: status === "rejected" ? "AMOUNT_EXCEEDS_PER_TXN" : "STEPUP_AMOUNT_THRESHOLD" },
    }
  })
}
