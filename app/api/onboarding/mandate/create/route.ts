import { cookies } from "next/headers"
import { requireUser } from "@/lib/auth/server"
import { kernelPost } from "@/lib/backend/client"
import { apiError } from "@/lib/http"

export async function POST() {
  try {
    const user = await requireUser()
    if (!process.env.KERNEL_API_URL && process.env.NODE_ENV !== "production") return Response.json({ demo: true, mandate_id: "mdt_demo", passkey_challenge: {} })
    const now = new Date(), expiry = new Date(now.getTime() + 30 * 86_400_000)
    const result = await kernelPost<{ mandate_id: string; passkey_challenge: Record<string, unknown> }>("/mandates", {
      user_id: user.id, agent_id: process.env.DEFAULT_AGENT_ID ?? "agt_flights", currency: "USD",
      scope: { categories: ["flights", "retail"], merchants: ["vuelaya", "vuelaya-mcp", "mami", "nauta"] },
      limits: { max_per_txn: "250.00", total_budget: "1500.00", max_txn: { count: 12, period: "month" } },
      validity: { not_before: now.toISOString(), expires_at: expiry.toISOString() },
      conditions: { "<=": [{ var: "offer.price" }, 250] },
      email: user.email,
    })
    const jar = await cookies(); jar.set("tt_mandate_draft", result.mandate_id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" })
    return Response.json({ options: result.passkey_challenge })
  } catch (error) { return apiError(error) }
}

