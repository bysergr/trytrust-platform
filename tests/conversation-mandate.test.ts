import { afterEach, describe, expect, it, vi } from "vitest"
import { getConversationAudit, getConversationMandate } from "@/lib/backend/client"

const originalKernelUrl = process.env.KERNEL_API_URL
const originalToken = process.env.KERNEL_SERVICE_TOKEN

afterEach(() => {
  process.env.KERNEL_API_URL = originalKernelUrl
  process.env.KERNEL_SERVICE_TOKEN = originalToken
  vi.unstubAllGlobals()
})

describe("conversation mandate resolution", () => {
  it("uses the configured agent mandate instead of querying by the Hanko user id", async () => {
    process.env.KERNEL_API_URL = "https://kernel.example"
    process.env.KERNEL_SERVICE_TOKEN = "test-token"
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      jti: "agent-mandate-jti",
      status: "active",
      spent: "0",
      reserved: "0",
      txn_count: 0,
      claims: {},
      memory: {},
    }), { status: 200, headers: { "Content-Type": "application/json" } }))
    vi.stubGlobal("fetch", fetchMock)

    const mandate = await getConversationMandate("hanko-user-id")

    expect(mandate?.jti).toBe("agent-mandate-jti")
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://kernel.example/agent/mandate")
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
    })
  })

  it("rejects an inactive configured agent mandate", async () => {
    process.env.KERNEL_API_URL = "https://kernel.example"
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      jti: "inactive-jti",
      status: "revoked",
      spent: "0",
      reserved: "0",
      txn_count: 0,
      claims: {},
      memory: {},
    }), { status: 200, headers: { "Content-Type": "application/json" } })))

    await expect(getConversationMandate("hanko-user-id")).resolves.toBeNull()
  })

  it("loads analytics from the configured agent audit lane", async () => {
    process.env.KERNEL_API_URL = "https://kernel.example"
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      seq: 1,
      event_id: "evt-1",
      type: "purchase.captured",
      actor: "agent",
      created_at: "2026-08-30T12:00:00.000Z",
      payload: { purchase_id: "purchase-1", receipt: { amount: "95", currency: "USD" } },
    }]), { status: 200, headers: { "Content-Type": "application/json" } }))
    vi.stubGlobal("fetch", fetchMock)

    const events = await getConversationAudit("hanko-user-id")

    expect(events).toHaveLength(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://kernel.example/agent/audit?limit=1000")
  })
})
