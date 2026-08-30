import { getPublicSite } from "@/lib/db/repository"
import { analyticsForUser, bindingPayload } from "@/lib/analytics/server"
import { publicBindingPayload } from "@/lib/analytics/public"
import { apiError } from "@/lib/http"

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params, site = await getPublicSite(slug)
    if (!site) return Response.json({ error: "Not found" }, { status: 404 })
    const payload = bindingPayload(await analyticsForUser(site.ownerId), site.version?.sourceContext.proposal as Record<string, unknown> | undefined)
    return Response.json(publicBindingPayload(payload, site.publicConfig.bindingAllowlist), { headers: { "Cache-Control": "public, max-age=10, stale-while-revalidate=20" } })
  } catch (error) { return apiError(error) }
}
