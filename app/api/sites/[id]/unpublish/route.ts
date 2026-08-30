import { requireUser } from "@/lib/auth/server"
import { unpublishSite } from "@/lib/db/repository"
import { apiError } from "@/lib/http"

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await requireUser(), { id } = await context.params; return Response.json(await unpublishSite(user.id, id)) }
  catch (error) { return apiError(error) }
}
