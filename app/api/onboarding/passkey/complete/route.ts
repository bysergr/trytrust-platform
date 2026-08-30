import { cookies } from "next/headers"
import { z } from "zod"
import { requireUser } from "@/lib/auth/server"
import { kernelPost } from "@/lib/backend/client"
import { apiError, parseJson } from "@/lib/http"

const credentialSchema = z.record(z.string(), z.unknown())
export async function POST(request: Request) {
  try {
    const user = await requireUser(), jar = await cookies(), challenge = jar.get("tt_passkey_challenge")?.value
    if (!process.env.KERNEL_API_URL && process.env.NODE_ENV !== "production") return Response.json({ demo: true })
    if (!challenge) return Response.json({ error: "Passkey challenge expired" }, { status: 400 })
    const credential = credentialSchema.parse((await parseJson(request)).credential)
    const result = await kernelPost("/passkeys/register/complete", { user_id: user.id, challenge, credential })
    jar.delete("tt_passkey_challenge"); return Response.json(result)
  } catch (error) { return apiError(error) }
}

