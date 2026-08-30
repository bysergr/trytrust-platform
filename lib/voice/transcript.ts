import type { RealtimeItem } from "@openai/agents-realtime"

export type VoiceTurn = {
  id: string
  role: "user" | "assistant"
  text: string
}

/** Convert incremental Realtime history into captions that are safe to render. */
export function toVoiceTurns(history: RealtimeItem[]): VoiceTurn[] {
  const turns: VoiceTurn[] = []

  for (const item of history) {
    if (item.type !== "message") continue
    if (item.role !== "user" && item.role !== "assistant") continue

    const text = item.content
      .map((part) => {
        switch (part.type) {
          case "input_text":
          case "output_text":
            return part.text
          case "input_audio":
          case "output_audio":
            return part.transcript ?? ""
          default:
            return ""
        }
      })
      .join(" ")
      .trim()

    if (text) turns.push({ id: item.itemId, role: item.role, text })
  }

  return turns
}
