import { cookies } from "next/headers"
import { z } from "zod"
import { requireUser } from "@/lib/auth/server"
import { kernelPost } from "@/lib/backend/client"
import { apiError, parseJson } from "@/lib/http"

const credentialSchema = z.record(z.string(), z.unknown())
export async function POST(request: Request) {
  try {
    await requireUser(); const jar = await cookies(), mandateId = jar.get("tt_mandate_draft")?.value
    if (!process.env.KERNEL_API_URL && process.env.NODE_ENV !== "production") return Response.json({ demo: true, status: "active" })
    if (!mandateId) return Response.json({ error: "Mandate draft expired" }, { status: 400 })
    const credential = credentialSchema.parse((await parseJson(request)).credential)
    const result = await kernelPost(`/mandates/${encodeURIComponent(mandateId)}/passkey/assert`, credential)
    jar.delete("tt_mandate_draft"); return Response.json(result)
  } catch (error) { return apiError(error) }
}

