import { requireUser } from "@/lib/auth/server"
import { getSite, updateSite } from "@/lib/db/repository"
import { siteUpdateSchema } from "@/lib/types"
import { apiError, parseJson } from "@/lib/http"

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await requireUser(), { id } = await context.params; const site = await getSite(user.id, id); return site ? Response.json(site) : Response.json({ error: "Not found" }, { status: 404 }) }
  catch (error) { return apiError(error) }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await requireUser(), { id } = await context.params; return Response.json(await updateSite(user.id, id, siteUpdateSchema.parse(await parseJson(request)))) }
  catch (error) { return apiError(error) }
}
