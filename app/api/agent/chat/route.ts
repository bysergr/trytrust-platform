import { requireUser } from "@/lib/auth/server"
import { askAgent, getActiveMandate } from "@/lib/backend/client"
import { isBareDecision } from "@/lib/backend/turns"
import { saveSession, ownSession } from "@/lib/db/repository"
import { generateArtifact, shouldGenerateArtifact } from "@/lib/artifacts/generate"
import { agentChatRequestSchema, type AgentRun } from "@/lib/types"
import { apiError, parseJson } from "@/lib/http"

export async function POST(request: Request) {
  try {
    const user = await requireUser()
    const body = agentChatRequestSchema.parse(await parseJson(request))
    if (body.sessionId && !(await ownSession(user.id, body.sessionId))) return Response.json({ error: "Session not found" }, { status: 404 })

    const decision = body.turn === "approve" || body.turn === "reject"
    const text = decision ? body.turn : body.text!
    if (!decision && isBareDecision(text)) {
      return Response.json({ error: "DECISION_NEEDS_EXPLICIT_TURN", message: "That reads as a decision on a pending escalation. Send it as an approve or reject turn so the caller confirms it deliberately." }, { status: 409 })
    }

    const mandate = await getActiveMandate(user.id)
    if (!mandate) return Response.json({ error: "ONBOARDING_REQUIRED", message: "Create and activate a mandate before using the agent." }, { status: 409 })
    const agentId = process.env.DEFAULT_AGENT_ID ?? "agt_flights"
    const raw = await askAgent({ text, sessionId: body.sessionId, agentId, mandateJti: mandate.jti, person: user.name })
    const sessionId = String(raw.session_id)
    const run = raw.run && typeof raw.run === "object" ? raw.run as AgentRun : null
    await saveSession(user.id, sessionId, agentId, mandate.jti)
    // A decision resolves an escalation; there is no new brief to render.
    const artifact = !decision && shouldGenerateArtifact(text, run as Record<string, unknown> | null)
      ? await generateArtifact({ request: text, replies: raw.replies, proposal: run?.proposal, result: run?.result })
      : null
    return Response.json({ sessionId, replies: Array.isArray(raw.replies) ? raw.replies.map(String) : [], run, awaitingHuman: Boolean(raw.awaiting_human), artifact })
  } catch (error) { return apiError(error) }
}
