import { requireUser } from "@/lib/auth/server"
import { REALTIME_MODEL, REALTIME_VOICE } from "@/lib/voice/config"
import { apiError } from "@/lib/http"

/**
 * Step 1 of the live audio flow: mint a short-lived ephemeral client secret.
 *
 * The long-lived OPENAI_API_KEY never leaves the server. The browser gets back
 * an `ek_...` value that is only good for opening one Realtime connection, and
 * asks for a fresh one every time it connects. Signed-in users only — a secret
 * minted here is billable.
 *
 * Anything that must stay secret — hosted MCP `authorization` headers, for
 * example — belongs in the `session` payload below, not in browser code.
 */
/**
 * One secret per connection is all a session needs, so a burst is either a
 * retry loop or someone running up the bill. Per instance and in memory: this
 * blunts a loop from one browser, it is not a rate limiter, and behind several
 * instances each keeps its own count.
 */
const COOLDOWN_MS = 3_000
const lastMinted = new Map<string, number>()

export async function POST() {
  try {
    const user = await requireUser()

    const now = Date.now()
    const previous = lastMinted.get(user.id)
    if (previous && now - previous < COOLDOWN_MS) {
      return Response.json({ error: "Slow down — a voice session was just started." }, { status: 429 })
    }
    lastMinted.set(user.id, now)

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return Response.json({ error: "OPENAI_API_KEY is not set on the server" }, { status: 500 })

    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        session: { type: "realtime", model: REALTIME_MODEL, audio: { output: { voice: REALTIME_VOICE } } },
      }),
    })

    if (!response.ok) {
      console.error("client_secrets failed", response.status, await response.text())
      return Response.json({ error: "Could not create a realtime client secret" }, { status: 502 })
    }

    const clientSecret: { value: string; expires_at: number } = await response.json()
    return Response.json({ value: clientSecret.value, expiresAt: clientSecret.expires_at }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) { return apiError(error) }
}
