import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth/server", () => ({ requireUser: vi.fn() }))

import { POST } from "@/app/api/realtime/client-secret/route"
import { requireUser } from "@/lib/auth/server"
import { REALTIME_MODEL, REALTIME_VOICE } from "@/lib/voice/config"

const mockedRequireUser = vi.mocked(requireUser)
const originalApiKey = process.env.OPENAI_API_KEY

describe("realtime client secret", () => {
  afterEach(() => {
    process.env.OPENAI_API_KEY = originalApiKey
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("fails closed when the server key is missing", async () => {
    mockedRequireUser.mockResolvedValue({ id: "voice-no-key" } as never)
    delete process.env.OPENAI_API_KEY

    const response = await POST()

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: "OPENAI_API_KEY is not set on the server" })
  })

  it("mints a no-store ephemeral secret for an authenticated user", async () => {
    mockedRequireUser.mockResolvedValue({ id: "voice-with-key" } as never)
    process.env.OPENAI_API_KEY = "server-only-test-key"
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      value: "ek_test_ephemeral",
      expires_at: 1_787_000_000,
    }), { status: 200, headers: { "Content-Type": "application/json" } }))
    vi.stubGlobal("fetch", fetchMock)

    const response = await POST()

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    await expect(response.json()).resolves.toEqual({
      value: "ek_test_ephemeral",
      expiresAt: 1_787_000_000,
    })
    expect(fetchMock).toHaveBeenCalledWith("https://api.openai.com/v1/realtime/client_secrets", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer server-only-test-key" }),
      body: JSON.stringify({
        session: { type: "realtime", model: REALTIME_MODEL, audio: { output: { voice: REALTIME_VOICE } } },
      }),
    }))
  })
})
