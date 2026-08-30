import { requireUser } from "@/lib/auth/server"
import { getAgentLimits } from "@/lib/backend/client"
import { apiError } from "@/lib/http"

export async function GET() {
  try {
    await requireUser()
    return Response.json(await getAgentLimits())
  } catch (error) { return apiError(error) }
}
