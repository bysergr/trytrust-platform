import { requireUser } from "@/lib/auth/server"
import { analyticsForAgent } from "@/lib/analytics/server"
import { apiError } from "@/lib/http"

export async function GET(request: Request) {
  try {
    const user = await requireUser(), params = new URL(request.url).searchParams
    const range = ["7d", "30d", "90d", "all"].includes(params.get("range") ?? "") ? params.get("range")! : "30d"
    return Response.json(await analyticsForAgent(user.id, range, params.get("currency") ?? undefined))
  } catch (error) { return apiError(error) }
}
