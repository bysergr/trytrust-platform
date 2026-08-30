import { requireUser } from "@/lib/auth/server"
import { getAgentMandate } from "@/lib/backend/client"
import { apiError } from "@/lib/http"

export async function GET() {
  try {
    await requireUser()
    return Response.json(await getAgentMandate())
  } catch (error) { return apiError(error) }
}
