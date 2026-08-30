"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { Mic, MicOff, Phone, PhoneOff, Square } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useVoiceSession } from "@/hooks/use-voice-session"
import { getConversation, getServerConversation, subscribe } from "@/lib/voice/conversation"
import { toVoiceTurns } from "@/lib/voice/transcript"
import { cn } from "@/lib/utils"

export function VoiceConsole() {
  const {
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
  } = useVoiceSession()

  // What the kernel thinks is happening, which is not always what the agent
  // just said out loud — the run outlives the voice session.
  const conversation = useSyncExternalStore(subscribe, getConversation, getServerConversation)

  const [draft, setDraft] = useState("")
  const transcriptRef = useRef<HTMLDivElement>(null)

  const turns = useMemo(() => toVoiceTurns(history), [history])
  const connected = status === "connected"

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" })
  }, [turns.length, agentSpeaking])

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn(
              "size-2.5 rounded-full transition-colors",
              connected ? "bg-emerald-500" : "bg-muted-foreground/30",
              agentSpeaking && "animate-pulse bg-sky-500"
            )}
          />
          <div>
            <h1 className="text-sm font-semibold">Tower Control</h1>
            <p className="text-xs text-muted-foreground">
              {status === "connecting"
                ? "Connecting…"
                : connected
                  ? agentSpeaking
                    ? "Speaking — talk over it to interrupt"
                    : "Listening"
                  : "Not connected"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {connected && (
            <>
              <Button variant="outline" size="sm" onClick={toggleMute} aria-pressed={muted}>
                {muted ? <MicOff data-icon="inline-start" /> : <Mic data-icon="inline-start" />}
                {muted ? "Unmute" : "Mute"}
              </Button>
              <Button variant="outline" size="sm" onClick={interrupt} disabled={!agentSpeaking}>
                <Square data-icon="inline-start" />
                Stop
              </Button>
            </>
          )}
          <Button
            variant={connected ? "destructive" : "default"}
            size="sm"
            onClick={connected ? disconnect : connect}
            disabled={status === "connecting"}
          >
            {connected ? (
              <>
                <PhoneOff data-icon="inline-start" />
                End
              </>
            ) : (
              <>
                <Phone data-icon="inline-start" />
                {status === "connecting" ? "Connecting…" : "Start session"}
              </>
            )}
          </Button>
        </div>
      </header>

      {error && (
        <p role="alert" className="border-b border-destructive/20 bg-destructive/10 px-6 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_22rem]">
        <section className="flex min-h-0 flex-col">
          <div ref={transcriptRef} className="flex-1 space-y-3 overflow-y-auto p-6">
            {turns.length === 0 && (
              <div className="mx-auto max-w-md pt-16 text-center">
                <p className="text-sm text-muted-foreground">
                  Start the session and just talk. Try{" "}
                  <span className="text-foreground">&ldquo;find me a flight to Cordoba, cheapest you can&rdquo;</span> or{" "}
                  <span className="text-foreground">&ldquo;how much is left on my mandate?&rdquo;</span>.
                </p>
              </div>
            )}

            {turns.map((turn) => (
              <div key={turn.id} className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}>
                <p
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                    turn.role === "user" ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground ring-1 ring-border"
                  )}
                >
                  {turn.text}
                </p>
              </div>
            ))}
          </div>

          <form
            className="flex gap-2 border-t border-border p-4"
            onSubmit={(event) => {
              event.preventDefault()
              sendText(draft)
              setDraft("")
            }}
          >
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={!connected}
              placeholder="Or type into the same conversation…"
              aria-label="Send a text message to the voice agent"
            />
            <Button type="submit" size="sm" disabled={!connected || !draft.trim()}>
              Send
            </Button>
          </form>
        </section>

        <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto border-t border-border p-4 lg:border-t-0 lg:border-l">
          {approvals.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Needs your approval</h2>
              {approvals.map((approval) => (
                <div key={approval.id} className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
                  <div>
                    <p className="font-mono text-xs font-medium">{approval.toolName}</p>
                    <pre className="mt-1 overflow-x-auto text-xs text-muted-foreground">{approval.args}</pre>
                  </div>
                  <div className="flex gap-2">
                    <Button size="xs" onClick={() => resolveApproval(approval, true)}>
                      Approve
                    </Button>
                    <Button size="xs" variant="outline" onClick={() => resolveApproval(approval, false)}>
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {conversation.run && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Kernel run</h2>
              <div
                className={cn(
                  "space-y-1 rounded-xl border p-3 text-xs",
                  conversation.awaitingHuman ? "border-amber-500/40 bg-amber-500/5" : "border-border"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono">{conversation.run.run_id}</span>
                  <span className="tracking-wide uppercase">{conversation.run.status.replace("_", " ")}</span>
                </div>
                {conversation.run.node && (
                  <p className="text-muted-foreground">
                    at <span className="font-mono">{conversation.run.node}</span>
                  </p>
                )}
              </div>
            </section>
          )}

          <section className="space-y-2">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Kernel calls</h2>

            {toolActivity.length === 0 ? (
              <p className="text-xs text-muted-foreground">Tool calls show up here as the agent makes them.</p>
            ) : (
              <ul className="space-y-2">
                {toolActivity.map((entry) => (
                  <li key={entry.id} className="rounded-xl border border-border p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-medium">{entry.name}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] tracking-wide uppercase",
                          entry.status === "running" ? "bg-sky-500/10 text-sky-600" : "bg-emerald-500/10 text-emerald-600"
                        )}
                      >
                        {entry.status}
                      </span>
                    </div>
                    <pre className="mt-2 overflow-x-auto text-muted-foreground">{entry.args}</pre>
                    {entry.result && <pre className="mt-2 max-h-32 overflow-auto text-muted-foreground">{entry.result}</pre>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
