import { afterEach, describe, expect, it, vi } from "vitest"

import {
  getConversation,
  recordBuyerRequest,
  resetConversation,
  takeBuyerRequest,
} from "@/lib/voice/conversation"
import { writeTools } from "@/lib/voice/tools"

describe("voice request fidelity", () => {
  afterEach(() => {
    resetConversation()
    vi.unstubAllGlobals()
  })

  it("forwards the buyer's typed words instead of a model-invented category", () => {
    recordBuyerRequest("I wanna buy water bottle")

    expect(takeBuyerRequest("I want to buy a wearable.")).toBe(
      "I wanna buy water bottle",
    )
  })

  it("consumes the stored request so it cannot leak into a later turn", () => {
    recordBuyerRequest("una botella de agua")

    expect(takeBuyerRequest("a water bottle")).toBe("una botella de agua")
    expect(takeBuyerRequest("find something to eat")).toBe("find something to eat")
  })

  it("can continue a text session when voice starts on the root page", () => {
    resetConversation("ses_from_text")

    expect(getConversation()).toMatchObject({
      sessionId: "ses_from_text",
      run: null,
      awaitingHuman: false,
    })
  })

  it("sends the raw buyer request to the kernel, not the tool argument", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      sessionId: "ses_water",
      replies: [],
      run: null,
      awaitingHuman: false,
      artifact: null,
    }), { status: 200, headers: { "Content-Type": "application/json" } }))
    vi.stubGlobal("fetch", fetchMock)
    recordBuyerRequest("I wanna buy water bottle")

    const askAgent = writeTools.find((tool) => tool.name === "ask_agent")
    if (!askAgent) throw new Error("ask_agent is not registered")
    await askAgent.invoke(undefined as never, JSON.stringify({
      request: "I want to buy a wearable.",
    }))

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      turn: "request",
      text: "I wanna buy water bottle",
    })
  })
})
