import { requireUser } from "@/lib/auth/server"
import { getPendingEscalations } from "@/lib/backend/client"
import { apiError } from "@/lib/http"

export async function GET() {
  try {
    await requireUser()
    return Response.json(await getPendingEscalations())
  } catch (error) { return apiError(error) }
}
