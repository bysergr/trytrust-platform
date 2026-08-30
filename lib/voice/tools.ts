import { tool } from "@openai/agents-realtime"
import { z } from "zod"

import { getConversation, recordTurn, takeBuyerRequest } from "@/lib/voice/conversation"
import type {
  AgentAuditEvent,
  AgentChainVerification,
  AgentChatResponse,
  AgentEscalation,
  AgentMandate,
  AgentRunRow,
  AgentWatch,
} from "@/lib/types"

/**
 * Function tools run wherever the `RealtimeSession` runs. Our session lives in
 * the browser, so these execute in the browser too — which is why every one of
 * them is a thin call to this app's own Route Handlers. Those resolve the
 * signed-in user, check the session belongs to them, and pick the mandate; the
 * browser never names one.
 *
 * Nothing here plans, prices, compares offers or decides. `ask_agent` hands the
 * turn to the kernel's graph and the graph does all of that behind the mandate
 * gate — so the voice lane can do what the agent can do, and nothing more.
 */
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const body = payload as { message?: string; error?: string } | null
    throw new Error(body?.message ?? body?.error ?? `Request failed with ${response.status}`)
  }
  return payload as T
}

/** Every turn shape goes through here so the session id is never dropped. */
async function sendTurn(turn: "request" | "guidance" | "approve" | "reject", text?: string) {
  const { sessionId } = getConversation()
  const response = await api<AgentChatResponse>("/api/agent/chat", {
    method: "POST",
    // The first turn has no session yet. Omit the field rather than encoding
    // the absence as JSON null; subsequent turns retain the kernel session.
    body: JSON.stringify({ turn, text, ...(sessionId ? { sessionId } : {}) }),
  })

  recordTurn(response)

  return {
    // Already written for a person by the kernel — relay it, do not re-derive.
    say: response.replies,
    awaitingYou: response.awaitingHuman,
    runStatus: response.run?.status ?? "done",
    result: response.run?.result ?? null,
  }
}

const askAgent = tool({
  name: "ask_agent",
  description:
    "Give the buying agent a new job — a purchase to make or a search to run, " +
    "using the buyer's newest words verbatim. Never substitute, translate, " +
    "summarize, classify, or infer a different product or category. The kernel chooses the matching mandate-scoped " +
    "agent, including Rappi for groceries and delivery. The agent plans and " +
    "proposes under that mandate; any payment remains behind the gate and the " +
    "merchant bridge. Use this for any new request. Do not use it to answer a " +
    "pending escalation.",
  parameters: z.object({
    request: z
      .string()
      .describe('Copy the buyer\'s newest request exactly. Preserve the product and all constraints. For example, "I wanna buy water bottle" must never become a wearable, smartwatch, fitness band, or another item.'),
  }),
  async execute({ request }) {
    return sendTurn("request", takeBuyerRequest(request))
  },
})

const redirectAgent = tool({
  name: "redirect_agent",
  description:
    "Send the buyer's new instructions into a run that is already going, or is " +
    'parked waiting on them — "find something cheaper", "not that airline". ' +
    "While a run is parked, redirecting refuses the pending purchase and looks " +
    "again, so use it when the buyer says no *and* says what they would rather have.",
  parameters: z.object({
    instruction: z.string().describe("What the buyer wants changed, in their own words."),
  }),
  async execute({ instruction }) {
    return sendTurn("guidance", instruction)
  },
})

const approvePendingPurchase = tool({
  name: "approve_pending_purchase",
  description:
    "Approve the purchase the agent is parked on. Only call this when the buyer " +
    "has clearly said yes to the specific amount you read back to them. " +
    "Approving re-runs the check before paying — it authorises a retry, not a bypass.",
  // The one turn that can move money past a limit. The session emits
  // `tool_approval_requested` and blocks until the console confirms.
  needsApproval: true,
  parameters: z.object({
    // Not sent anywhere: the kernel classifies an approval turn by its text,
    // and "approve — 300 USD for the business fare" reads as guidance, not as
    // an approval, which would refuse the purchase instead of allowing it.
    // The parameter earns its place by forcing the model to state the amount
    // before it can call this, and the console renders it on the approval card
    // so the operator confirms against a number rather than a tool name.
    amountReadBack: z
      .string()
      .describe('The amount and item you read out loud, e.g. "300 dollars for the flexible business fare". Shown to the operator on the confirmation.'),
  }),
  async execute() {
    return sendTurn("approve")
  },
})

const rejectPendingPurchase = tool({
  name: "reject_pending_purchase",
  description:
    "Refuse the purchase the agent is parked on. Nothing is charged. Use this " +
    "when the buyer says no without saying what to look for instead.",
  parameters: z.object({}),
  async execute() {
    return sendTurn("reject")
  },
})

const getRunStatus = tool({
  name: "get_run_status",
  description:
    "Check what the agent is doing right now: which step it is on, what it " +
    'proposed, whether it is waiting on the buyer. Use this for "what happened?" or "are you done?".',
  parameters: z.object({}),
  async execute() {
    const { sessionId } = getConversation()
    if (!sessionId) return { count: 0, runs: [], note: "Nothing has been asked yet in this conversation." }

    const runs = await api<AgentRunRow[]>(`/api/agent/runs?sessionId=${encodeURIComponent(sessionId)}`)
    return {
      count: runs.length,
      runs: runs.slice(0, 3).map((run) => ({
        runId: run.run_id,
        status: run.status,
        node: run.node,
        request: run.state?.request,
        proposal: run.state?.proposal,
        result: run.state?.result,
      })),
    }
  },
})

const getPendingEscalations = tool({
  name: "get_pending_escalations",
  description:
    "List everything waiting on a human decision right now, across every run. " +
    "Each one expires on its own — no answer means refused.",
  parameters: z.object({}),
  async execute() {
    const escalations = await api<AgentEscalation[]>("/api/agent/escalations")
    return {
      count: escalations.length,
      escalations: escalations.map((e) => ({ id: e.id, runId: e.run_id, expiresAt: e.timeout_at })),
    }
  },
})

const getMandate = tool({
  name: "get_mandate",
  description:
    "What the agent is allowed to spend and what it has spent: the per-purchase " +
    'cap, the total budget, how many purchases are left, and where it may shop. ' +
    'Use this for "how much is left" or "can you even buy that".',
  parameters: z.object({}),
  async execute() {
    const mandate = await api<AgentMandate>("/api/agent/mandate")
    return {
      status: mandate.status,
      currency: mandate.claims.currency ?? "USD",
      spent: mandate.spent,
      reserved: mandate.reserved,
      purchasesMade: mandate.txn_count,
      maxPerPurchase: mandate.claims.limits?.max_per_txn,
      totalBudget: mandate.claims.limits?.total_budget,
      maxPurchases: mandate.claims.limits?.max_txn,
      expiresAt: mandate.claims.validity?.expires_at,
      merchants: mandate.claims.scope?.merchants,
      history: mandate.memory,
    }
  },
})

const getWatches = tool({
  name: "get_watches",
  description:
    "List the standing orders the agent is polling while nobody is here — what " +
    "it is watching for and at what price.",
  parameters: z.object({}),
  async execute() {
    const watches = await api<AgentWatch[]>("/api/agent/watches")
    return {
      count: watches.length,
      watches: watches.map((w) => ({
        id: w.id,
        looksFor: safeParse(w.query),
        firesWhen: safeParse(w.threshold),
        everySeconds: w.interval_s,
        lastChecked: w.last_checked_at,
      })),
    }
  },
})

const createWatch = tool({
  name: "create_watch",
  description:
    'Set a standing order: "keep watching, and buy it if it drops below this". ' +
    "It keeps running after the call ends, and when it fires it goes through the " +
    "same mandate gate as a spoken purchase. Read the price and the destination " +
    "back before calling it.",
  // A standing order buys while nobody is listening — that gets a click.
  needsApproval: true,
  parameters: z.object({
    maxPrice: z.number().positive().describe("Buy only at or below this price, in the mandate's currency."),
    destination: z.string().nullable().describe('Destination code such as "COR", or null for anywhere.'),
    origin: z.string().nullable().describe('Origin code such as "BOG", or null for anywhere.'),
    date: z.string().nullable().describe("Departure date as YYYY-MM-DD, or null for any date."),
  }),
  async execute({ maxPrice, destination, origin, date }) {
    const watch = await api<{ watch_id: string; threshold: string }>("/api/agent/watches", {
      method: "POST",
      body: JSON.stringify({ maxPrice, destination, origin, date }),
    })
    return { ok: true, watchId: watch.watch_id, firesWhen: watch.threshold }
  },
})

const getAuditTrail = tool({
  name: "get_audit_trail",
  description:
    "Read the agent's audit chain — every decision, refusal and payment, in " +
    'order. Use this for "what did you do", "why was that refused", or when the ' +
    "buyer wants an account of the agent's actions.",
  parameters: z.object({
    limit: z.number().int().min(1).max(40).describe("How many events to read. Keep it small for spoken answers."),
  }),
  async execute({ limit }) {
    const events = await api<AgentAuditEvent[]>(`/api/agent/audit?limit=${limit}`)
    return {
      count: events.length,
      events: events.map((e) => ({ seq: e.seq, what: e.type, at: e.created_at, actor: e.actor, detail: e.payload })),
    }
  },
})

const verifyAuditChain = tool({
  name: "verify_audit_chain",
  description:
    "Recompute the audit chain and check it against its signed checkpoint. " +
    'Answers "can I trust this record" — it either verifies or it does not.',
  parameters: z.object({}),
  async execute() {
    const verification = await api<AgentChainVerification>("/api/agent/audit?verify=1")
    return {
      valid: verification.chains.valid,
      chains: verification.chains.chains,
      eventsChecked: verification.chains.checked,
      checkpoint: verification.checkpoint,
    }
  },
})

const getGuardrails = tool({
  name: "get_guardrails",
  description:
    "The operational guardrails: rate limits, rolling counters and held locks. " +
    "Use this when the buyer asks why the agent is throttled or why something failed closed.",
  parameters: z.object({}),
  async execute() {
    return api<Record<string, unknown>>("/api/agent/limits")
  },
})

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

export const readTools = [getRunStatus, getPendingEscalations, getMandate, getWatches, getAuditTrail, verifyAuditChain, getGuardrails]

/** Turns that change something in the kernel. */
export const writeTools = [askAgent, redirectAgent, approvePendingPurchase, rejectPendingPurchase, createWatch]

/** Names that require approval — used to label the confirmation UI. */
export const APPROVAL_TOOL_NAMES = new Set([approvePendingPurchase, createWatch].map((t) => t.name))
