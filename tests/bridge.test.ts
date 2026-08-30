import { afterEach, describe, expect, it, vi } from "vitest"

import {
  BRIDGE_URL,
  connectManualToken,
  fetchPaymentMethods,
  fetchSessionStatus,
} from "@/lib/bridge"

describe("Rappi bridge client", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("loads the local session without caching credentials", async () => {
    const status = {
      state: "captured",
      has_token: true,
      account_label: "Cuenta Rappi",
      address_label: "Casa",
      error: null,
      started_at: "2026-08-30T12:00:00Z",
    } as const
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(status)))
    vi.stubGlobal("fetch", fetchMock)

    await expect(fetchSessionStatus()).resolves.toEqual(status)
    expect(fetchMock).toHaveBeenCalledWith(`${BRIDGE_URL}/v1/rappi/session/status`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    })
  })

  it("sends a manually supplied token only to the configured bridge", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ state: "captured" })))
    vi.stubGlobal("fetch", fetchMock)

    await connectManualToken("ft.private-token")

    expect(fetchMock).toHaveBeenCalledWith(`${BRIDGE_URL}/v1/rappi/session/manual`, {
      method: "POST",
      body: JSON.stringify({ token: "ft.private-token" }),
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    })
  })

  it("unwraps payment methods and surfaces bridge errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ methods: [{ id: "cash" }] })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "sesión vencida" }), { status: 401 })
      )
    vi.stubGlobal("fetch", fetchMock)

    await expect(fetchPaymentMethods()).resolves.toEqual([{ id: "cash" }])
    await expect(fetchPaymentMethods()).rejects.toThrow("sesión vencida")
  })
})
