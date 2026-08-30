import { requireUser } from "@/lib/auth/server"
import { getSite } from "@/lib/db/repository"
import { analyticsForUser, bindingPayload } from "@/lib/analytics/server"
import { apiError } from "@/lib/http"

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(), { id } = await context.params, site = await getSite(user.id, id)
    if (!site) return Response.json({ error: "Not found" }, { status: 404 })
    return Response.json(bindingPayload(await analyticsForUser(user.id), site.version?.sourceContext.proposal as Record<string, unknown> | undefined))
  } catch (error) { return apiError(error) }
}
