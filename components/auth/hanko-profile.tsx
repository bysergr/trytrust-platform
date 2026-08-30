"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Fingerprint, LoaderCircle, ShieldCheck } from "lucide-react"
import type { Hanko, State } from "@teamhanko/hanko-elements"
import { Button } from "@/components/ui/button"

type ProfileState = State<"profile_init">
type EmptyAction = { enabled: boolean; run(): Promise<unknown> }

export function HankoProfile({ demo = false, setup = false, next = "/" }: { demo?: boolean; setup?: boolean; next?: string }) {
  const api = process.env.NEXT_PUBLIC_HANKO_API_URL
  const router = useRouter()
  const hankoRef = useRef<Hanko | null>(null)
  const stateRef = useRef<ProfileState | null>(null)
  const [passkeys, setPasskeys] = useState<Array<{ id: string; name?: string; created_at: string }>>([])
  const [loading, setLoading] = useState(Boolean(api && !demo))
  const [creating, setCreating] = useState(false)
  const [supported, setSupported] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!api || demo) return
    let cancelled = false
    void import("@teamhanko/hanko-elements").then(async ({ register, WebauthnSupport }) => {
      const [{ hanko }, available] = await Promise.all([register(api, { enablePasskeys: true, sessionTokenLocation: "cookie" }), WebauthnSupport.isPlatformAuthenticatorAvailable()])
      const state = await loadProfile(hanko)
      if (cancelled) return
      hankoRef.current = hanko; stateRef.current = state; setSupported(available)
      setPasskeys(state.payload?.user.passkeys ?? []); setLoading(false)
    }).catch((cause) => { console.error("Hanko passkey profile failed", cause); setError("Your passkey settings could not be loaded."); setLoading(false) })
    return () => { cancelled = true }
  }, [api, demo])

  async function createPasskey() {
    const hanko = hankoRef.current
    let state = stateRef.current
    if (!hanko || !state) return
    setCreating(true); setError(undefined)
    try {
      const createAction = state.actions.webauthn_credential_create as unknown as EmptyAction | undefined
      if (!createAction?.enabled) throw new Error("Passkey creation is disabled in Hanko.")
      await createAction.run()
      state = await loadProfile(hanko)
      stateRef.current = state
      setPasskeys(state.payload?.user.passkeys ?? [])
      router.refresh()
    } catch (cause) {
      console.error("Passkey creation failed", cause)
      setError("Touch ID registration was cancelled or could not be completed.")
    } finally { setCreating(false) }
  }

  if (demo || !api) return <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground"><Fingerprint className="mb-4 size-6 text-primary" />Account passkeys become available when <code className="font-mono text-foreground">NEXT_PUBLIC_HANKO_API_URL</code> is configured.</div>
  if (loading) return <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin text-primary" />Checking this device and your registered passkeys…</div>

  const ready = passkeys.length > 0
  return <div className="space-y-6">
    {setup && <div className={`rounded-2xl border p-4 ${ready ? "border-primary/20 bg-primary/5" : "bg-muted/45"}`}><div className="flex gap-3">{ready ? <Check className="mt-0.5 size-5 text-primary" /> : <ShieldCheck className="mt-0.5 size-5 text-primary" />}<div><p className="text-sm font-medium">{ready ? "Touch ID is ready" : "One last security step"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{ready ? "This account can now sign in without Google, passwords, or passcodes." : "Create a passkey on this device before entering your TryTrust workspace."}</p></div></div></div>}
    <div><div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-semibold">Your passkeys</h2><p className="mt-1 text-xs text-muted-foreground">Biometrics remain on your device and are never shared.</p></div><span className="font-mono text-[10px] text-muted-foreground">{passkeys.length} registered</span></div>
      {passkeys.length ? <div className="divide-y rounded-2xl border">{passkeys.map((passkey) => <div key={passkey.id} className="flex items-center gap-3 p-4"><div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><Fingerprint className="size-4" /></div><div className="min-w-0"><p className="truncate text-sm font-medium">{passkey.name || "Device passkey"}</p><p className="font-mono text-[9px] text-muted-foreground">Created {new Date(passkey.created_at).toLocaleDateString()}</p></div><Check className="ml-auto size-4 text-primary" /></div>)}</div> : <div className="rounded-2xl border border-dashed p-5 text-xs leading-5 text-muted-foreground">No passkey is registered for this account yet.</div>}
    </div>
    <Button onClick={createPasskey} disabled={creating || !supported} variant={ready ? "outline" : "default"} className="h-11 w-full sm:w-auto">{creating ? <LoaderCircle className="animate-spin" /> : <Fingerprint />}{ready ? "Add another passkey" : supported ? "Create passkey with Touch ID" : "Platform passkey unavailable"}</Button>
    {!supported && <p className="text-xs leading-5 text-muted-foreground">This browser does not expose a platform authenticator. Open this page directly in Safari or Chrome on a Touch ID-enabled Mac.</p>}
    {error && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">{error}</p>}
    {setup && ready && <Button className="h-11 w-full" onClick={() => { window.location.assign(next) }}>Continue to TryTrust<Check /></Button>}
  </div>
}

async function loadProfile(hanko: Hanko): Promise<ProfileState> {
  const state = await hanko.createState("profile", { cacheKey: "trytrust-hanko-profile", loadFromCache: false })
  if (state.name !== "profile_init") throw new Error(state.error?.message ?? "Hanko profile is unavailable")
  return state
}
