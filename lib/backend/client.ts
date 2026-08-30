import type { AuditEvent, Mandate } from "@/lib/types"

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
