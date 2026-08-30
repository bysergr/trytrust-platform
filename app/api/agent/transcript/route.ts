import { requireUser } from "@/lib/auth/server"
import { getTranscript } from "@/lib/backend/client"
import { ownSession } from "@/lib/db/repository"
import { apiError } from "@/lib/http"

export async function GET(request: Request) {
  try {
    const user = await requireUser()
    const sessionId = new URL(request.url).searchParams.get("sessionId")
    if (!sessionId || !(await ownSession(user.id, sessionId))) return Response.json({ error: "Session not found" }, { status: 404 })
    return Response.json(await getTranscript(sessionId))
  } catch (error) { return apiError(error) }
}

