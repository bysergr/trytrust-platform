import { requireUser } from "@/lib/auth/server"
import { getAgentAudit, verifyAgentChain } from "@/lib/backend/client"
import { apiError } from "@/lib/http"

/** The agent lane's hash chain. `?verify=1` recomputes it instead of listing. */
export async function GET(request: Request) {
  try {
    await requireUser()
    const params = new URL(request.url).searchParams
    if (params.get("verify")) return Response.json(await verifyAgentChain())
    const limit = Number(params.get("limit") ?? 20)
    return Response.json(await getAgentAudit(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 20))
  } catch (error) { return apiError(error) }
}
