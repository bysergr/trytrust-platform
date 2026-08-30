import { requireUser } from "@/lib/auth/server"
import { askAgent, dispatchAgent } from "@/lib/backend/client"
import { isBareDecision } from "@/lib/backend/turns"
import { saveSession, ownSession } from "@/lib/db/repository"
import { generateArtifact, shouldGenerateArtifact } from "@/lib/artifacts/generate"
import { agentChatRequestSchema, type AgentRun } from "@/lib/types"
import { apiError, parseJson } from "@/lib/http"

export async function POST(request: Request) {
  try {
    const user = await requireUser()
    const body = agentChatRequestSchema.parse(await parseJson(request))
    const priorSession = body.sessionId ? await ownSession(user.id, body.sessionId) : null
    if (body.sessionId && !priorSession) return Response.json({ error: "Session not found" }, { status: 404 })

    const decision = body.turn === "approve" || body.turn === "reject"
    const text = decision ? body.turn : body.text!
    if (!decision && isBareDecision(text)) {
      return Response.json({ error: "DECISION_NEEDS_EXPLICIT_TURN", message: "That reads as a decision on a pending escalation. Send it as an approve or reject turn so the caller confirms it deliberately." }, { status: 409 })
    }

    // Only the first turn is dispatched. Later turns must stay on the
    // agent/mandate that owns the session: an "approve" must never be routed
    // afresh from a one-word voice command.
    // `/agent/dispatch` filters active mandates in the agent lane's own
    // store. The general `/mandates` registry is a separate read model and
    // cannot prove that a selected Rappi agent may spend under its mandate.
    const raw = priorSession
      ? await askAgent({
          text,
          sessionId: body.sessionId,
          agentId: priorSession.agentId,
          mandateJti: priorSession.mandateJti,
          person: user.name,
        })
      : await dispatchAgent({ text, person: user.name })
    const binding = priorSession ?? dispatchBinding(raw)
    const sessionId = String(raw.session_id)
    const run = raw.run && typeof raw.run === "object" ? raw.run as AgentRun : null
    await saveSession(user.id, sessionId, binding.agentId, binding.mandateJti)
    // A decision resolves an escalation; there is no new brief to render.
    const artifact = !decision && shouldGenerateArtifact(text, run as Record<string, unknown> | null)
      ? await generateArtifact({ request: text, replies: raw.replies, proposal: run?.proposal, result: run?.result })
      : null
    return Response.json({ sessionId, replies: Array.isArray(raw.replies) ? raw.replies.map(String) : [], run, awaitingHuman: Boolean(raw.awaiting_human), artifact })
  } catch (error) { return apiError(error) }
}

function dispatchBinding(raw: Record<string, unknown>) {
  const dispatch = raw.dispatch
  if (!dispatch || typeof dispatch !== "object") throw new Error("KERNEL_DISPATCH_INVALID")
  const fields = dispatch as Record<string, unknown>
  const agentId = fields.agent_id
  const mandateJti = fields.mandate_jti
  if (typeof agentId !== "string" || !agentId || typeof mandateJti !== "string" || !mandateJti) {
    throw new Error("KERNEL_DISPATCH_INVALID")
  }
  return { agentId, mandateJti }
}
