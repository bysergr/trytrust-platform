import { requireUser } from "@/lib/auth/server"
import { createSite, listSites } from "@/lib/db/repository"
import { siteCreateSchema } from "@/lib/types"
import { sanitizeArtifactHtml } from "@/lib/artifacts/sanitize"
import { apiError, parseJson } from "@/lib/http"

export async function GET() {
  try { const user = await requireUser(); return Response.json(await listSites(user.id)) }
  catch (error) { return apiError(error) }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(), body = siteCreateSchema.parse(await parseJson(request))
    body.artifact.html = sanitizeArtifactHtml(body.artifact.html)
    return Response.json(await createSite(user.id, body.artifact, body.sourceContext), { status: 201 })
  } catch (error) { return apiError(error) }
}

