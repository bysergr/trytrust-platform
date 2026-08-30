"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Fingerprint } from "lucide-react"
import { Button } from "@/components/ui/button"

export function HankoAuth({ next = "/" }: { next?: string }) {
  const api = process.env.NEXT_PUBLIC_HANKO_API_URL, [error, setError] = useState<string>()
  useEffect(() => {
    if (!api) return
    let cleanup: (() => void) | undefined
    void import("@teamhanko/hanko-elements").then(({ register }) => register(api, { enablePasskeys: true, hidePasskeyButtonOnLogin: false, sessionTokenLocation: "cookie" })).then(({ hanko }) => { cleanup = hanko.onSessionCreated(() => { window.location.assign(next) }) }).catch(() => setError("Authentication could not be loaded. Check the Hanko App URL and allowed redirects."))
    return () => { cleanup?.() }
  }, [api, next])
  if (!api) return <div className="rounded-2xl border border-dashed bg-background/60 p-5"><div className="mb-2 flex items-center gap-2 text-sm font-medium"><Fingerprint className="size-4 text-primary" />Development workspace</div><p className="mb-4 text-xs leading-5 text-muted-foreground">Hanko is not configured, so this local build uses the isolated demo identity. Production remains fail-closed.</p><Button render={<Link href={next} />}>Enter demo workspace<ArrowRight /></Button></div>
  if (error) return <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>
  return <hanko-auth />
}
