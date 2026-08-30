import { requireUser } from "@/lib/auth/server"
import { getPurchaseTrace } from "@/lib/backend/client"
import { apiError } from "@/lib/http"

/** The full mandate ancestry a purchase settled against — the child mandate plus every ancestor it walked and debited. */
export async function GET(_request: Request, context: { params: Promise<{ purchase_id: string }> }) {
  try { await requireUser(); const { purchase_id } = await context.params; return Response.json(await getPurchaseTrace(purchase_id)) }
  catch (error) { return apiError(error) }
}
