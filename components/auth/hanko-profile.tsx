"use client"

import { useEffect, useState } from "react"
import { Fingerprint } from "lucide-react"

export function HankoProfile({ demo = false }: { demo?: boolean }) {
  const api = process.env.NEXT_PUBLIC_HANKO_API_URL
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!api) return
    void import("@teamhanko/hanko-elements")
      .then(({ register }) => register(api, { enablePasskeys: true, sessionTokenLocation: "cookie" }))
      .catch(() => setError("The Hanko security profile could not be loaded."))
  }, [api])

  if (demo || !api) return (
    <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
      <Fingerprint className="mb-4 size-6 text-primary" />
      Account passkeys are managed by Hanko once <code className="font-mono text-foreground">NEXT_PUBLIC_HANKO_API_URL</code> is configured. The separate mandate-signing credential is available from Agent onboarding.
    </div>
  )
  if (error) return <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>
  return <hanko-profile />
}
