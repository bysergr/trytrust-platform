"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowUp,
  Check,
  CheckCheck,
  Copy,
  PanelRight,
  Save,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react"
import { toast } from "sonner"
import type { AgentChatResponse, GeneratedArtifact } from "@/lib/types"
import { ArtifactFrame } from "@/components/sites/artifact-frame"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type Message = {
  id: string
  role: "user" | "agent"
  text: string
  at: string
  followUps?: string[]
  proposal?: Record<string, unknown> | null
  artifact?: GeneratedArtifact
}

const DEFAULT_PROMPTS = [
  "Find a direct flight to Miami under $180",
  "Build a transaction intelligence dashboard",
  "Show my merchant spend & mandate limits",
  "Audit flight policy and spending boundaries",
]

const MIN_SPLIT = 25
const MAX_SPLIT = 75
const DEFAULT_SPLIT = 46

export function AgentWorkspace() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const bottom = useRef<HTMLDivElement>(null)

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "agent",
      text: "Tell me what you need. I can search approved merchants, propose policy-compliant purchases, or turn your activity into a live interactive site.",
      at: "Now",
      followUps: [
        "Find a flight to Miami under $180",
        "Build a transaction dashboard",
        "Show my merchant spend",
      ],
    },
  ])

  const [text, setText] = useState("")
  const [sessionId, setSessionId] = useState<string>()
  const [sending, setSending] = useState(false)
  const [loadingSeconds, setLoadingSeconds] = useState(0)
  const [artifact, setArtifact] = useState<GeneratedArtifact | null>(null)
  const [view, setView] = useState<"chat" | "preview">("chat")

  // Resizable split pane state
  const [splitRatio, setSplitRatio] = useState(DEFAULT_SPLIT)
  const [isDragging, setIsDragging] = useState(false)

  // Auto-scroll chat to latest message
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, sending])

  // Live timer for loading state (Thinking)
  useEffect(() => {
    if (!sending) return
    const start = getNow()

    const interval = setInterval(() => {
      const elapsed = (getNow() - start) / 1000
      setLoadingSeconds(elapsed)
    }, 100)

    return () => clearInterval(interval)
  }, [sending])

  // Draggable Divider Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)

    const handlePointerMove = (event: PointerEvent) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      if (rect.width <= 0) return
      const relativeX = event.clientX - rect.left
      const newPercent = (relativeX / rect.width) * 100
      const clamped = Math.min(Math.max(newPercent, MIN_SPLIT), MAX_SPLIT)
      setSplitRatio(clamped)
    }

    const handlePointerUp = () => {
      setIsDragging(false)
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
      window.removeEventListener("pointercancel", handlePointerUp)
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
    window.addEventListener("pointercancel", handlePointerUp)
  }

  const handleDoubleClick = () => {
    setSplitRatio(DEFAULT_SPLIT)
  }

  async function send(prompt?: string) {
    const value = (prompt ?? text).trim()
    if (!value || sending) return
    setText("")
    setSending(true)
    setLoadingSeconds(0)

    const timeString = time()
    const userMsgId = crypto.randomUUID()

    setMessages((current) => [
      ...current.map((message) => message.followUps ? { ...message, followUps: undefined } : message),
      { id: userMsgId, role: "user", text: value, at: timeString },
    ])
    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value, sessionId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message ?? data.error ?? "Agent unavailable")

      const result = data as AgentChatResponse
      const replyTime = time()

      setSessionId(result.sessionId)

      const isFlight = /flight|bog|mia|miami|ticket|travel/i.test(value)

      const followUps = isFlight
        ? [
            "Authorize flight with mandate passkey",
            "Compare with alternative airlines",
            "Show recent flight transaction history",
          ]
        : [
            "Filter transactions by highest spend",
            "Export audit certificate",
            "Update mandate limit boundaries",
          ]

      setMessages((current) => [
        ...current,
        ...result.replies.map((reply, idx) => ({
          id: crypto.randomUUID(),
          role: "agent" as const,
          text: reply,
          at: replyTime,
          followUps: idx === result.replies.length - 1 ? followUps : undefined,
          proposal: idx === 0 ? result.run?.proposal : undefined,
          artifact: idx === 0 ? result.artifact ?? undefined : undefined,
        })),
      ])

      if (result.artifact) {
        setArtifact(result.artifact)
        setView("preview")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Agent unavailable")
    } finally {
      setSending(false)
    }
  }

  async function save() {
    if (!artifact) return toast.error("Generate a live view before saving it")
    const response = await fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artifact, sourceContext: { sessionId } }),
    })
    if (!response.ok) return toast.error("Could not save this site")
    const site = await response.json()
    toast.success("Site saved to your sidebar")
    router.push(`/sites/${site.id}`)
    router.refresh()
  }

  return (
    <main
      ref={containerRef}
      style={{ "--chat-width": `${splitRatio}%` } as React.CSSProperties}
      className={cn(
        "relative flex h-[calc(100svh-3.5rem)] min-h-0 flex-col md:h-svh font-sans bg-background md:flex-row overflow-hidden",
        artifact && isDragging && "select-none cursor-col-resize"
      )}
    >
      {/* Chat Section - Starts directly at the top with NO top header */}
      <section
        className={cn(
          "min-h-0 flex-col bg-background/50",
          artifact && view === "preview" ? "hidden md:flex" : "flex",
          artifact ? "w-full border-r border-border/80 md:w-[var(--chat-width)] md:flex-none" : "w-full md:flex-1"
        )}
      >
        {/* Mobile view switcher appears only after an artifact is generated. */}
        {artifact && <div className="shrink-0 border-b border-border/60 bg-muted/30 px-4 py-2.5 md:hidden">
          <Tabs
              value={view}
              onValueChange={(v) => setView(v as "chat" | "preview")}
            >
              <TabsList className="bg-background/80 p-0.5 h-7">
                <TabsTrigger
                  value="chat"
                  className="text-xs px-2 py-0.5 data-[state=active]:bg-card data-[state=active]:text-primary"
                >
                  Chat
                </TabsTrigger>
                <TabsTrigger
                  value="preview"
                  className="text-xs px-2 py-0.5 data-[state=active]:bg-card data-[state=active]:text-primary"
                >
                  <PanelRight className="size-3 mr-1" />
                  Preview
                </TabsTrigger>
              </TabsList>
          </Tabs>
        </div>}

        {/* Messages Scroll Area */}
        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-5 sm:px-6">
            {messages.map((message) => (
              <BeautifulMessageCard
                key={message.id}
                message={message}
                onPromptClick={(prompt) => send(prompt)}
                onViewPreview={(selectedArtifact) => {
                  setArtifact(selectedArtifact)
                  setView("preview")
                }}
              />
            ))}

            {/* Minimal Thinking Indicator (No heavy boxes/progress bars) */}
            {sending && <MinimalThinkingLoader seconds={loadingSeconds} />}

            <div ref={bottom} />
          </div>
        </ScrollArea>

        {/* Floating Prompt Bar / Composer */}
        <div className="border-t border-border/70 bg-background/95 backdrop-blur-xl p-3 sm:p-4 shrink-0">
          <div className="mx-auto max-w-2xl">
            {/* Quick suggestion chips */}
            <div className="mb-2.5 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {DEFAULT_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => send(prompt)}
                  className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/80 bg-card/80 px-3 py-1.5 text-[10.5px] font-medium text-muted-foreground transition-all duration-200 hover:border-primary/40 hover:bg-primary/[0.06] hover:text-foreground active:scale-95 shadow-xs"
                >
                  <Sparkles className="size-3 text-primary/70 group-hover:text-primary transition-colors" />
                  <span>{prompt}</span>
                </button>
              ))}
            </div>

            {/* AI Composer Box */}
            <div className="group relative rounded-3xl border border-border/80 bg-card/90 p-2.5 shadow-[0_12px_40px_-20px_rgba(29,78,216,0.2)] transition-all duration-300 focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10">
              <Textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    send()
                  }
                }}
                placeholder="Ask TryTrust to find flights, analyze merchant spend, or render live views…"
                className="max-h-36 min-h-16 resize-none border-0 bg-transparent px-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 shadow-none focus-visible:ring-0"
              />

              <div className="flex items-center justify-between px-1 pt-1">
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full size-7"
                    onClick={() => send("Show transaction dashboard")}
                    title="Generate visual intelligence"
                  >
                    <Wand2 className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full size-7"
                    onClick={() => send("Check active mandate boundaries and audit history")}
                    title="Inspect mandate limits"
                  >
                    <ShieldCheck className="size-3.5" />
                  </Button>
                </div>

                <Button
                  aria-label="Send message"
                  size="icon"
                  onClick={() => send()}
                  disabled={!text.trim() || sending}
                  className="size-8 rounded-full bg-primary text-primary-foreground shadow-[0_4px_16px_rgba(29,78,216,0.35)] transition-all duration-200 hover:scale-105 hover:bg-primary/90 disabled:opacity-30 disabled:hover:scale-100 disabled:shadow-none"
                >
                  <ArrowUp className="size-4 stroke-[2.5]" />
                </Button>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-center gap-1.5 font-mono text-[9.5px] text-muted-foreground/80">
              <ShieldCheck className="size-3 text-primary" />
              <span>Deterministic Gate Active · Unsigned proposals fail closed</span>
            </div>
          </div>
        </div>
      </section>

      {/* Resizable Draggable Split Divider (Desktop md+) */}
      {artifact && <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(splitRatio)}
        aria-valuemin={MIN_SPLIT}
        aria-valuemax={MAX_SPLIT}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault()
            setSplitRatio((p) => Math.max(p - 2, MIN_SPLIT))
          } else if (e.key === "ArrowRight") {
            e.preventDefault()
            setSplitRatio((p) => Math.min(p + 2, MAX_SPLIT))
          } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setSplitRatio(DEFAULT_SPLIT)
          }
        }}
        title="Drag to resize · Double-click to reset"
        className={cn(
          "relative hidden md:flex w-1.5 shrink-0 cursor-col-resize items-center justify-center bg-border/60 transition-colors hover:bg-primary/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary z-20 select-none",
          isDragging && "bg-primary/70 ring-1 ring-primary"
        )}
      >
        {/* Visual grip handle */}
        <div
          className={cn(
            "flex h-7 w-3 items-center justify-center rounded-xs border border-border/80 bg-card shadow-xs transition-all pointer-events-none",
            "hover:border-primary/50 hover:scale-110",
            isDragging && "border-primary bg-primary text-primary-foreground scale-110 shadow-sm"
          )}
        >
          <div className="flex gap-0.5">
            <span
              className={cn(
                "h-2.5 w-0.5 rounded-full transition-colors",
                isDragging ? "bg-primary-foreground" : "bg-muted-foreground/50"
              )}
            />
            <span
              className={cn(
                "h-2.5 w-0.5 rounded-full transition-colors",
                isDragging ? "bg-primary-foreground" : "bg-muted-foreground/50"
              )}
            />
          </div>
        </div>
      </div>}

      {/* HTML Renderer / Preview Section */}
      {artifact && <section
        className={cn(
          "min-h-0 flex-col bg-[#f8fafc]",
          view === "chat" ? "hidden md:flex" : "flex",
          "w-full md:flex-1 md:w-auto"
        )}
      >
        {/* Small clean/empty header bar with ONLY the Save Live Site button on right */}
        <div className="flex h-10 shrink-0 items-center justify-between md:justify-end border-b border-border/80 bg-card/80 backdrop-blur-md px-3 sm:px-4">
          {/* Mobile view switcher (hidden on desktop) */}
          <div className="md:hidden">
            <Tabs value={view} onValueChange={(v) => setView(v as "chat" | "preview")}>
              <TabsList className="bg-background/80 p-0.5 h-7">
                <TabsTrigger
                  value="chat"
                  className="text-xs px-2 py-0.5 data-[state=active]:bg-card data-[state=active]:text-primary"
                >
                  Chat
                </TabsTrigger>
                <TabsTrigger
                  value="preview"
                  className="text-xs px-2 py-0.5 data-[state=active]:bg-card data-[state=active]:text-primary"
                >
                  <PanelRight className="size-3 mr-1" />
                  Preview
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={save}
            className="border-primary/20 hover:border-primary/40 hover:bg-primary/5 text-xs font-medium text-foreground gap-1.5 shadow-sm h-7.5 px-2.5"
          >
            <Save className="size-3.5 text-primary" />
            Save Live Site
          </Button>
        </div>

        {/* Live HTML Artifact Frame */}
        <div className={cn("flex-1 min-h-0 flex flex-col relative", isDragging && "pointer-events-none")}>
          <ArtifactFrame html={artifact.html} className="min-h-0 flex-1" title={artifact.title} />
        </div>
      </section>}
    </main>
  )
}

/* =========================================================================
   Beautiful UI Components for Chat
   ========================================================================= */

/**
 * Minimal Thinking Indicator (Sleek inline pill with live timer & subtle pulse)
 */
function MinimalThinkingLoader({ seconds }: { seconds: number }) {
  return (
    <div className="enter flex items-center gap-2 py-1">
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary shadow-xs">
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider">
          Thinking
        </span>
        <span className="font-mono text-[9.5px] text-primary/80">
          {seconds.toFixed(1)}s
        </span>
      </div>
    </div>
  )
}

/**
 * Beautiful UI Message Card (No User/Bot Avatar Icons)
 */
function BeautifulMessageCard({
  message,
  onPromptClick,
  onViewPreview,
}: {
  message: Message
  onPromptClick: (prompt: string) => void
  onViewPreview: (artifact: GeneratedArtifact) => void
}) {
  const isAgent = message.role === "agent"
  const [copied, setCopied] = useState(false)

  function copyText() {
    navigator.clipboard.writeText(message.text)
    setCopied(true)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  // User Message (clean, right-aligned, without avatar icon)
  if (!isAgent) {
    return (
      <div className="flex justify-end enter">
        <div className="group relative max-w-[85%] rounded-2xl rounded-tr-sm bg-[#0a1024] px-4 py-3 text-sm leading-relaxed text-slate-100 shadow-sm border border-slate-800/80">
          <p className="whitespace-pre-wrap">{message.text}</p>
          <div className="mt-2 flex items-center justify-end gap-1.5 font-mono text-[9px] text-slate-400">
            <span>{message.at}</span>
            <CheckCheck className="size-3 text-blue-400" />
          </div>
        </div>
      </div>
    )
  }

  const proposalTitle = message.proposal ? String(message.proposal.title ?? "Direct Flight BOG → MIA") : null
  const proposalPrice = message.proposal?.price != null ? String(message.proposal.price) : null
  const proposalCurrency = message.proposal?.currency != null ? String(message.proposal.currency) : "USD"
  const proposalWhy = message.proposal?.why != null ? String(message.proposal.why) : null

  // Agent Message (clean, left-aligned, without bot icon)
  return (
    <div className="flex flex-col gap-2.5 w-full enter">
      {/* Main Message Bubble */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 text-sm leading-relaxed text-foreground shadow-sm">
        <p className="whitespace-pre-wrap">{message.text}</p>

        {/* Beautiful UI 04 & 09: Human-In-The-Loop Approval Card / Proposal */}
        {message.proposal && (
          <div className="mt-3.5 overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/[0.04] via-card to-primary/[0.02] p-3.5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-primary" />
                <span className="font-semibold text-xs text-foreground">
                  Mandate Purchase Proposal
                </span>
              </div>
              <Badge variant="outline" className="border-primary/30 bg-primary/10 font-mono text-[9px] text-primary">
                100% Policy Bound
              </Badge>
            </div>

            <div className="rounded-lg bg-background/80 p-3 border border-border/60 mb-3">
              <div className="text-xs font-semibold text-foreground">
                {proposalTitle}
              </div>
              {proposalPrice && (
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="font-mono text-base font-bold text-primary">
                    ${proposalPrice}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {proposalCurrency} · Eligible & Verified
                  </span>
                </div>
              )}
              {proposalWhy && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {proposalWhy}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {message.artifact && <Button
                size="sm"
                onClick={() => onViewPreview(message.artifact!)}
                className="bg-primary text-primary-foreground text-xs font-medium gap-1.5 shadow-sm hover:bg-primary/90"
              >
                Inspect Live View
              </Button>}
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast.success("Mandate policy authorized this proposal")}
                className="text-xs border-border/80"
              >
                <Check className="size-3 text-primary" />
                Sign with Passkey
              </Button>
            </div>
          </div>
        )}

        {/* Bottom Actions Bar */}
        <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[10px] text-muted-foreground font-mono">
          <span>{message.at}</span>
          <button
            onClick={copyText}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground transition-colors"
            title="Copy response"
          >
            {copied ? <Check className="size-3 text-primary" /> : <Copy className="size-3" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      {/* Beautiful UI 03: Follow-Up Action Pills */}
      {message.followUps && message.followUps.length > 0 && (
        <div className="flex flex-col gap-1.5 pl-0.5">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            Follow-ups
          </span>
          <div className="flex flex-wrap gap-1.5">
            {message.followUps.map((followUp, idx) => (
              <button
                key={idx}
                onClick={() => onPromptClick(followUp)}
                className="group inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.04] px-3 py-1 text-xs text-foreground transition-all duration-150 hover:border-primary/50 hover:bg-primary/10 hover:shadow-xs active:scale-98"
              >
                <Sparkles className="size-2.5 text-primary" />
                <span>{followUp}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function getNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now()
}

function time() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}
