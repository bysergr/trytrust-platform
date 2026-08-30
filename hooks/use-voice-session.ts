"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { RealtimeSession, type RealtimeItem } from "@openai/agents-realtime"

import { resetConversation } from "@/lib/voice/conversation"
import { towerControlAgent } from "@/lib/voice/agent"
import { REALTIME_MODEL, REALTIME_VOICE } from "@/lib/voice/config"

export type SessionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnecting"

export type ToolActivity = {
  id: string
  name: string
  args: string
  result?: string
  status: "running" | "done"
  at: number
}

/** The approval payload we actually render, flattened out of the SDK event. */
export type PendingApproval = {
  id: string
  toolName: string
  args: string
  // Kept opaque on purpose — it goes straight back to session.approve/reject.
  approvalItem: Parameters<RealtimeSession["approve"]>[0]
}

function argsOf(rawItem: unknown): string {
  const args = (rawItem as { arguments?: unknown })?.arguments
  if (typeof args === "string") {
    try {
      return JSON.stringify(JSON.parse(args), null, 2)
    } catch {
      return args
    }
  }
  return args ? JSON.stringify(args, null, 2) : "{}"
}

export function useVoiceSession() {
  const sessionRef = useRef<RealtimeSession | null>(null)

  const [status, setStatus] = useState<SessionStatus>("idle")
  const [history, setHistory] = useState<RealtimeItem[]>([])
  const [toolActivity, setToolActivity] = useState<ToolActivity[]>([])
  const [approvals, setApprovals] = useState<PendingApproval[]>([])
  const [agentSpeaking, setAgentSpeaking] = useState(false)
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const disconnect = useCallback(() => {
    sessionRef.current?.close()
    sessionRef.current = null
    setStatus("idle")
    setAgentSpeaking(false)
    setApprovals([])
    setMuted(false)
    // The kernel keeps the run; hanging up just stops speaking for it.
    resetConversation()
  }, [])

  // Closing the transport on unmount also releases the microphone.
  useEffect(() => () => sessionRef.current?.close(), [])

  const connect = useCallback(async () => {
    if (sessionRef.current) return

    setError(null)
    setStatus("connecting")
    resetConversation()

    try {
      // Step 1: the application server mints a short-lived client secret.
      const response = await fetch("/api/realtime/client-secret", {
        method: "POST",
      })
      const payload = (await response.json()) as {
        value?: string
        error?: string
      }
      if (!response.ok || !payload.value) {
        throw new Error(payload.error ?? "Could not start a voice session")
      }

      // Step 2: build the session. In a browser this picks the WebRTC
      // transport, which wires up the microphone and playback for us.
      const session = new RealtimeSession(towerControlAgent, {
        model: REALTIME_MODEL,
        config: {
          outputModalities: ["audio"],
          // Low effort keeps first-audio latency down; raise it if the agent
          // needs to reason harder before it answers.
          reasoning: { effort: "low" },
          audio: {
            input: {
              transcription: {
                model: "gpt-live-transcribe",
                delay: "low",
                // `languages` (plural) is what gpt-live-transcribe and
                // gpt-transcribe take; older models use singular `language`.
                languages: ["en", "es"],
              },
              noiseReduction: { type: "near_field" },
              // Semantic VAD reads intent rather than raw silence, so the
              // agent waits out a mid-sentence pause. interruptResponse is
              // what makes barge-in work.
              turnDetection: {
                type: "semantic_vad",
                eagerness: "medium",
                createResponse: true,
                interruptResponse: true,
              },
            },
            output: { voice: REALTIME_VOICE },
          },
        },
        workflowName: "TryTrust Tower Control",
      })

      session.on("history_updated", (items) => setHistory([...items]))

      session.on("audio_start", () => setAgentSpeaking(true))
      session.on("audio_stopped", () => setAgentSpeaking(false))
      session.on("audio_interrupted", () => setAgentSpeaking(false))

      session.on("agent_tool_start", (_ctx, _agent, tool, details) => {
        setToolActivity((prev) => [
          {
            id: details.toolCall.id ?? `${tool.name}-${Date.now()}`,
            name: tool.name,
            args: argsOf(details.toolCall),
            status: "running",
            at: Date.now(),
          },
          ...prev,
        ])
      })

      session.on("agent_tool_end", (_ctx, _agent, tool, result, details) => {
        const id = details.toolCall.id ?? ""
        setToolActivity((prev) =>
          prev.map((entry) =>
            entry.id === id || (!id && entry.name === tool.name && entry.status === "running")
              ? { ...entry, status: "done", result }
              : entry,
          ),
        )
      })

      session.on("tool_approval_requested", (_ctx, _agent, request) => {
        const { approvalItem } = request
        setApprovals((prev) => [
          ...prev,
          {
            id: approvalItem.rawItem.id ?? `${Date.now()}`,
            toolName:
              request.type === "function_approval"
                ? request.tool.name
                : (approvalItem.name ?? "tool"),
            args: argsOf(approvalItem.rawItem),
            approvalItem,
          },
        ])
      })

      session.on("agent_handoff", (_ctx, from, to) => {
        setToolActivity((prev) => [
          {
            id: `handoff-${Date.now()}`,
            name: "handoff",
            args: `${from.name} → ${to.name}`,
            status: "done",
            at: Date.now(),
          },
          ...prev,
        ])
      })

      session.on("error", (event) => {
        console.error("realtime session error", event)
        setError(
          event.error instanceof Error
            ? event.error.message
            : "The voice session hit an error",
        )
      })

      // Step 3: connect over WebRTC using the ephemeral secret.
      await session.connect({ apiKey: payload.value })

      sessionRef.current = session
      setMuted(session.muted ?? false)
      setStatus("connected")
    } catch (cause) {
      console.error(cause)
      setError(
        cause instanceof Error ? cause.message : "Could not start a voice session",
      )
      sessionRef.current?.close()
      sessionRef.current = null
      setStatus("idle")
    }
  }, [])

  const toggleMute = useCallback(() => {
    const session = sessionRef.current
    if (!session) return

    const next = !(session.muted ?? false)
    session.mute(next)
    setMuted(next)
  }, [])

  /** Manual barge-in, for operators who would rather tap than talk over it. */
  const interrupt = useCallback(() => {
    sessionRef.current?.interrupt()
    setAgentSpeaking(false)
  }, [])

  const sendText = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    sessionRef.current?.sendMessage(trimmed)
  }, [])

  const resolveApproval = useCallback(
    async (approval: PendingApproval, approved: boolean) => {
      const session = sessionRef.current
      if (!session) return

      setApprovals((prev) => prev.filter((a) => a.id !== approval.id))

      if (approved) {
        await session.approve(approval.approvalItem)
      } else {
        await session.reject(approval.approvalItem, {
          message: "The operator declined this action.",
        })
      }
    },
    [],
  )

  return {
    status,
    history,
    toolActivity,
    approvals,
    agentSpeaking,
    muted,
    error,
    connect,
    disconnect,
    toggleMute,
    interrupt,
    sendText,
    resolveApproval,
  }
}
