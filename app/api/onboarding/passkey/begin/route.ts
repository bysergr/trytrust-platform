import { cookies } from "next/headers"
import { requireUser } from "@/lib/auth/server"
import { kernelPost } from "@/lib/backend/client"
import { apiError } from "@/lib/http"

export async function POST() {
  try {
    const user = await requireUser()
    if (!process.env.KERNEL_API_URL && process.env.NODE_ENV !== "production") return Response.json({ demo: true })
    const result = await kernelPost<{ options: Record<string, unknown>; challenge: string }>("/passkeys/register/begin", { user_id: user.id, user_name: user.name })
    const jar = await cookies(); jar.set("tt_passkey_challenge", result.challenge, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 300, path: "/" })
    return Response.json({ options: result.options })
  } catch (error) { return apiError(error) }
}

