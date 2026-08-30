import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  askAgent: vi.fn(),
  dispatchAgent: vi.fn(),
  ownSession: vi.fn(),
  saveSession: vi.fn(),
}))

vi.mock("@/lib/auth/server", () => ({
  requireUser: vi.fn().mockResolvedValue({ id: "usr_1", name: "Fabian" }),
}))
vi.mock("@/lib/backend/client", () => ({
  askAgent: mocks.askAgent,
  dispatchAgent: mocks.dispatchAgent,
}))
vi.mock("@/lib/db/repository", () => ({
  ownSession: mocks.ownSession,
  saveSession: mocks.saveSession,
}))
vi.mock("@/lib/artifacts/generate", () => ({
  generateArtifact: vi.fn(),
  shouldGenerateArtifact: vi.fn().mockReturnValue(false),
}))

import { POST } from "@/app/api/agent/chat/route"

const dispatched = {
  session_id: "ses_rappi",
  replies: ["Encontré papas en Rappi."],
  awaiting_human: false,
  dispatch: { agent_id: "agt_rappi", mandate_jti: "mdt_rappi" },
}

describe("agent chat dispatch route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.ownSession.mockResolvedValue(null)
    mocks.dispatchAgent.mockResolvedValue(dispatched)
    mocks.saveSession.mockResolvedValue(undefined)
  })

  it("routes a first voice request through the dispatcher and stores its binding", async () => {
    const response = await POST(jsonRequest({ turn: "request", text: "Compra papas en Rappi" }))

    expect(response.status).toBe(200)
    expect(mocks.dispatchAgent).toHaveBeenCalledWith({ text: "Compra papas en Rappi", person: "Fabian" })
    expect(mocks.saveSession).toHaveBeenCalledWith("usr_1", "ses_rappi", "agt_rappi", "mdt_rappi")
  })

  it("keeps later approval turns on the Rappi session instead of dispatching again", async () => {
    mocks.ownSession.mockResolvedValue({
      ownerId: "usr_1",
      backendSessionId: "ses_rappi",
      agentId: "agt_rappi",
      mandateJti: "mdt_rappi",
    })
    mocks.askAgent.mockResolvedValue({
      session_id: "ses_rappi",
      replies: ["Aprobación recibida."],
      awaiting_human: false,
    })

    const response = await POST(jsonRequest({ turn: "approve", sessionId: "ses_rappi" }))

    expect(response.status).toBe(200)
    expect(mocks.dispatchAgent).not.toHaveBeenCalled()
    expect(mocks.askAgent).toHaveBeenCalledWith({
      text: "approve",
      sessionId: "ses_rappi",
      agentId: "agt_rappi",
      mandateJti: "mdt_rappi",
      person: "Fabian",
    })
  })
})

function jsonRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/agent/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}
