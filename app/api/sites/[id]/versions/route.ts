import { requireUser } from "@/lib/auth/server"
import { addSiteVersion } from "@/lib/db/repository"
import { siteVersionSchema } from "@/lib/types"
import { sanitizeArtifactHtml } from "@/lib/artifacts/sanitize"
import { apiError, parseJson } from "@/lib/http"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(), { id } = await context.params, body = siteVersionSchema.parse(await parseJson(request))
    body.artifact.html = sanitizeArtifactHtml(body.artifact.html)
    return Response.json(await addSiteVersion(user.id, id, body.artifact, body.sourceContext), { status: 201 })
  } catch (error) { return apiError(error) }
}
