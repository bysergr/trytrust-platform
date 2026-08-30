import "server-only"
import { cache } from "react"
import { cookies } from "next/headers"
import { z } from "zod"
import type { HankoUser } from "@/lib/types"
import { syncUser } from "@/lib/db/repository"

const DEMO_USER: HankoUser = {
  id: "usr_demo_trytrust",
  email: "marta@trytrust.lat",
  name: "Marta Rodriguez",
  hasAccountPasskey: true,
  isDemo: true,
}

const hankoSessionSchema = z.object({
  is_valid: z.boolean(),
  user_id: z.string().optional(),
  claims: z.object({
    subject: z.string().optional(),
    email: z.object({ address: z.string().email(), is_primary: z.boolean().optional(), is_verified: z.boolean().optional() }).optional(),
    name: z.string().optional(),
    picture: z.string().url().optional(),
  }).loose().optional(),
})

const hankoProfileSchema = z.object({
  user_id: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
  emails: z.array(z.object({ address: z.string().email(), is_primary: z.boolean().optional() }).loose()).optional(),
  passkeys: z.array(z.object({ id: z.string() }).loose()).optional(),
  webauthn_credentials: z.array(z.object({ id: z.string(), mfa_only: z.boolean().optional() }).loose()).optional(),
}).loose()

export const getCurrentUser = cache(async (): Promise<HankoUser | null> => {
  const api = process.env.NEXT_PUBLIC_HANKO_API_URL
  const jar = await cookies()
  const token = jar.get("hanko")?.value

  if (!api) {
    if (process.env.NODE_ENV === "production") return null
    await syncUser(DEMO_USER)
    return DEMO_USER
  }
  if (!token) return null

  try {
    const validation = await fetch(`${api}/sessions/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_token: token }),
      cache: "no-store",
    })
    if (!validation.ok) return null
    const session = hankoSessionSchema.parse(await validation.json())
    if (!session.is_valid) return null
    const id = session.claims?.subject ?? session.user_id
    if (!id) return null
    const profileResponse = await fetch(`${api}/me`, {
      headers: { Authorization: `Bearer ${token}`, Cookie: `hanko=${token}` },
      cache: "no-store",
    })
    const profileResult = profileResponse.ok ? hankoProfileSchema.safeParse(await profileResponse.json()) : null
    const profile = profileResult?.success ? profileResult.data : null
    const profileEmail = profile?.emails?.find((entry) => entry.is_primary)?.address ?? profile?.emails?.[0]?.address
    const email = session.claims?.email?.address ?? profileEmail ?? ""
    const passkeyCount = profile?.passkeys?.length
      ?? profile?.webauthn_credentials?.filter((credential) => !credential.mfa_only).length
      ?? 0
    const user: HankoUser = {
      id,
      email,
      name: profile?.name || session.claims?.name || email.split("@")[0] || "TryTrust user",
      avatarUrl: profile?.picture || session.claims?.picture || null,
      hasAccountPasskey: passkeyCount > 0,
    }
    await syncUser(user)
    return user
  } catch (error) {
    console.error("Hanko validation failed", error)
    return null
  }
})

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error("UNAUTHORIZED")
  if (!user.hasAccountPasskey && !user.isDemo) throw new Error("PASSKEY_ENROLLMENT_REQUIRED")
  return user
}
