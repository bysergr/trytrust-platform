import { afterEach, describe, expect, it, vi } from "vitest"

import { dispatchAgent } from "@/lib/backend/client"

describe("agent dispatcher client", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("starts a new request through the kernel dispatcher", async () => {
    vi.stubEnv("KERNEL_API_URL", "http://kernel.test/")
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      session_id: "ses_rappi",
      replies: ["I found chips on Rappi."],
      dispatch: { agent_id: "agt_rappi", mandate_jti: "mdt_rappi" },
    }), { status: 200, headers: { "Content-Type": "application/json" } }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(dispatchAgent({ text: "Compra papas en Rappi", person: "Fabian" })).resolves.toMatchObject({
      dispatch: { agent_id: "agt_rappi", mandate_jti: "mdt_rappi" },
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "http://kernel.test/agent/dispatch",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ text: "Compra papas en Rappi", person: "Fabian" }),
      }),
    )
  })
})
