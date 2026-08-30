import { requireUser } from "@/lib/auth/server"
import { askAgent, getActiveMandate } from "@/lib/backend/client"
import { saveSession, ownSession } from "@/lib/db/repository"
import { generateArtifact, shouldGenerateArtifact } from "@/lib/artifacts/generate"
import { agentChatRequestSchema, type AgentRun } from "@/lib/types"
import { apiError, parseJson } from "@/lib/http"

export async function POST(request: Request) {
  try {
    const user = await requireUser()
    const body = agentChatRequestSchema.parse(await parseJson(request))
    if (body.sessionId && !(await ownSession(user.id, body.sessionId))) return Response.json({ error: "Session not found" }, { status: 404 })

    const mandate = await getActiveMandate(user.id)
    if (!mandate) return Response.json({ error: "ONBOARDING_REQUIRED", message: "Create and activate a mandate before using the agent." }, { status: 409 })
    const agentId = process.env.DEFAULT_AGENT_ID ?? "agt_flights"
    const raw = await askAgent({ text: body.text, sessionId: body.sessionId, agentId, mandateJti: mandate.jti, person: user.name })
    const sessionId = String(raw.session_id)
    const run = raw.run && typeof raw.run === "object" ? raw.run as AgentRun : null
    await saveSession(user.id, sessionId, agentId, mandate.jti)
    const artifact = shouldGenerateArtifact(body.text, run as Record<string, unknown> | null)
      ? await generateArtifact({ request: body.text, replies: raw.replies, proposal: run?.proposal, result: run?.result })
      : null
    return Response.json({ sessionId, replies: Array.isArray(raw.replies) ? raw.replies.map(String) : [], run, awaitingHuman: Boolean(raw.awaiting_human), artifact })
  } catch (error) { return apiError(error) }
}

