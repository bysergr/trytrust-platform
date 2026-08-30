import { describe, expect, it } from "vitest"

import { agentChatRequestSchema } from "@/lib/types"

describe("agent chat request schema", () => {
  it("normalizes a null session from a first turn to an omitted session", () => {
    const request = agentChatRequestSchema.parse({
      turn: "request",
      text: "Buy some chips for me, any brand, within the mandate.",
      sessionId: null,
    })

    expect(request.sessionId).toBeUndefined()
  })

  it("continues to accept a returned session on later turns", () => {
    const request = agentChatRequestSchema.parse({
      turn: "guidance",
      text: "Make them salt and vinegar.",
      sessionId: "ses_01J8Z9X2K3",
    })

    expect(request.sessionId).toBe("ses_01J8Z9X2K3")
  })
})
