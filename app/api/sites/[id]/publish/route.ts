import { requireUser } from "@/lib/auth/server"
import { getSite, publishSite } from "@/lib/db/repository"
import { publishSiteSchema } from "@/lib/types"
import { apiError, parseJson } from "@/lib/http"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(), { id } = await context.params, body = publishSiteSchema.parse(await parseJson(request)), site = await getSite(user.id, id)
    if (!site?.version) return Response.json({ error: "Site has no version" }, { status: 409 })
    const allowed = new Map(site.version.bindings.map((binding) => [binding.id, new Set(binding.fields)]))
    for (const [bindingId, fields] of Object.entries(body.bindingAllowlist)) {
      if (!allowed.has(bindingId) || fields.some((field) => !allowed.get(bindingId)!.has(field))) return Response.json({ error: `Invalid public binding: ${bindingId}` }, { status: 400 })
    }
    return Response.json(await publishSite(user.id, id, body.bindingAllowlist))
  } catch (error) { return apiError(error) }
}
