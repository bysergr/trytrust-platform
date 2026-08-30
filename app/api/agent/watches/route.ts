import { requireUser } from "@/lib/auth/server"
import { createWatch, getWatches } from "@/lib/backend/client"
import { watchCreateSchema } from "@/lib/types"
import { apiError, parseJson } from "@/lib/http"

export async function GET() {
  try {
    await requireUser()
    return Response.json(await getWatches())
  } catch (error) { return apiError(error) }
}

/**
 * A standing order. When it fires it goes through the same mandate gate as a
 * spoken purchase, so an over-limit hit still parks on a human.
 */
export async function POST(request: Request) {
  try {
    await requireUser()
    const body = watchCreateSchema.parse(await parseJson(request))
    const query: Record<string, string> = { category: body.category ?? "flights" }
    if (body.destination) query.destination = body.destination
    if (body.origin) query.origin = body.origin
    if (body.date) query.date = body.date
    return Response.json(await createWatch({ maxPrice: body.maxPrice, query }), { status: 201 })
  } catch (error) { return apiError(error) }
}
