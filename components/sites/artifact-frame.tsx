"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { RefreshCw } from "lucide-react"
import { buildArtifactDocument } from "@/lib/artifacts/runtime"
import { cn } from "@/lib/utils"

export function ArtifactFrame({ html, dataUrl = "/api/analytics", className, title = "Generated site preview" }: { html: string; dataUrl?: string; className?: string; title?: string }) {
  const ref = useRef<HTMLIFrameElement>(null), [payload, setPayload] = useState<Record<string, unknown>>({}), [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    try { const response = await fetch(dataUrl, { cache: "no-store" }); if (response.ok) setPayload(await response.json()) }
    finally { setLoading(false) }
  }, [dataUrl])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => { void load() }, 15_000)
    return () => { window.clearInterval(timer) }
  }, [load])
  useEffect(() => {
    const listener = (event: MessageEvent) => { if (event.source === ref.current?.contentWindow && event.data?.type === "trytrust:ready") ref.current?.contentWindow?.postMessage({ type: "trytrust:data", payload }, "*") }
    window.addEventListener("message", listener); ref.current?.contentWindow?.postMessage({ type: "trytrust:data", payload }, "*")
    return () => window.removeEventListener("message", listener)
  }, [payload, html])

  return <div className={cn("relative min-h-0 overflow-hidden bg-[#f7f7fc]", className)}>
    {loading && <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-full border bg-background/90 px-3 py-1.5 font-mono text-[10px] text-muted-foreground shadow-sm"><RefreshCw className="size-3 animate-spin" />Syncing live data</div>}
    <iframe ref={ref} title={title} sandbox="allow-scripts" srcDoc={buildArtifactDocument(html)} className="h-full min-h-[520px] w-full border-0" />
  </div>
}
