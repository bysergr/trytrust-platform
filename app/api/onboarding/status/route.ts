import { requireUser } from "@/lib/auth/server"
import { getMandates } from "@/lib/backend/client"
import { apiError } from "@/lib/http"

export async function GET() {
  try { const user = await requireUser(), mandates = await getMandates(user.id); return Response.json({ ready: mandates.some((item) => item.status.toLowerCase() === "active"), mandates }) }
  catch (error) { return apiError(error) }
}

