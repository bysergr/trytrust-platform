import { describe, expect, it } from "vitest"
import type { RealtimeItem } from "@openai/agents-realtime"

import { toVoiceTurns } from "@/lib/voice/transcript"

describe("voice transcript", () => {
  it("renders finalized speech and skips empty audio items", () => {
    const history = [
      {
        itemId: "spoken-user",
        type: "message",
        role: "user",
        content: [{ type: "input_audio", transcript: "Busca un vuelo a Bogotá" }],
      },
      {
        itemId: "pending-agent",
        type: "message",
        role: "assistant",
        content: [{ type: "output_audio", transcript: null }],
      },
      {
        itemId: "spoken-agent",
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "Encontré una opción." }],
      },
    ] as unknown as RealtimeItem[]

    expect(toVoiceTurns(history)).toEqual([
      { id: "spoken-user", role: "user", text: "Busca un vuelo a Bogotá" },
      { id: "spoken-agent", role: "assistant", text: "Encontré una opción." },
    ])
  })
})
