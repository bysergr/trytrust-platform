"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, Fingerprint, LoaderCircle, ShieldCheck } from "lucide-react"
import type { Hanko } from "@teamhanko/hanko-elements"
import { Button } from "@/components/ui/button"

const LOGIN_CACHE = "trytrust-hanko-login"
const REGISTRATION_CACHE = "trytrust-hanko-registration"
const FLOW_KEY = "trytrust-hanko-active-flow"
const SERVER_REDIRECT_KEY = "trytrust-hanko-server-redirect"
type AuthFlow = "login" | "registration"
type GoogleAction = {
  enabled: boolean
  inputs: { provider: { allowed_values?: Array<{ name: string; value: string }> } }
  run(input: { provider: string; redirect_to: string; code_verifier: string }): Promise<unknown>
}
type EmptyAction = { enabled: boolean; run(): Promise<unknown> }

export function HankoAuth({ next = "/" }: { next?: string }) {
  const api = process.env.NEXT_PUBLIC_HANKO_API_URL
  const hankoRef = useRef<Hanko | null>(null)
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState<"google" | "passkey" | "callback">()
  const [platformPasskey, setPlatformPasskey] = useState(false)

  useEffect(() => {
    if (!api) return
    let cleanup: (() => void) | undefined
    let cancelled = false
    void import("@teamhanko/hanko-elements").then(async ({ register, WebauthnSupport }) => {
      const [{ hanko }, available] = await Promise.all([
        register(api, { enablePasskeys: true, hidePasskeyButtonOnLogin: false, sessionTokenLocation: "cookie" }),
        WebauthnSupport.isPlatformAuthenticatorAvailable(),
      ])
      if (cancelled) return
      hankoRef.current = hanko
      setPlatformPasskey(available)
      const redirectToWorkspace = () => {
        const previous = Number(window.sessionStorage.getItem(SERVER_REDIRECT_KEY) ?? 0)
        if (Date.now() - previous < 10_000) {
          setLoading(undefined)
          setError("Your Google session is valid, but TryTrust could not finish server setup. Please try again after the deployment configuration is updated.")
          return
        }
        window.sessionStorage.setItem(SERVER_REDIRECT_KEY, String(Date.now()))
        window.location.assign(next)
      }
      cleanup = hanko.onSessionCreated(() => {
        window.sessionStorage.removeItem(FLOW_KEY)
        redirectToWorkspace()
      })

      const activeFlow = window.sessionStorage.getItem(FLOW_KEY) as AuthFlow | null
      const params = new URLSearchParams(window.location.search)
      const isCallback = params.has("hanko_token") || params.has("error")
      if (activeFlow && isCallback) {
        setLoading("callback")
        await hanko.createState(activeFlow, {
          cacheKey: activeFlow === "login" ? LOGIN_CACHE : REGISTRATION_CACHE,
          loadFromCache: true,
        })
        return
      }

      const session = await hanko.validateSession()
      if (session.is_valid) {
        redirectToWorkspace()
      } else if (!isCallback && hanko.getSessionToken()) {
        await hanko.logout()
      }
    }).catch((cause) => {
      console.error("Hanko initialization failed", cause)
      setError("Secure authentication could not be loaded. Check the Hanko App URL and allowed redirects.")
      setLoading(undefined)
    })
    return () => { cancelled = true; cleanup?.() }
  }, [api, next])

  async function continueWithGoogle() {
    const hanko = hankoRef.current
    if (!hanko) return setError("Authentication is still loading. Please try again.")
    window.sessionStorage.removeItem(SERVER_REDIRECT_KEY)
    setError(undefined); setLoading("google")
    try {
      const { generateCodeVerifier, setStoredCodeVerifier } = await import("@teamhanko/hanko-elements")
      const state = await hanko.createState("registration", { cacheKey: REGISTRATION_CACHE, loadFromCache: false })
      if (state.name !== "registration_init") throw new Error("Google registration is not enabled in Hanko.")
      const googleAction = state.actions.thirdparty_oauth as unknown as GoogleAction | undefined
      if (!googleAction?.enabled) throw new Error("Google registration is not enabled in Hanko.")
      const providers = googleAction.inputs.provider.allowed_values ?? []
      if (!providers.some((provider) => provider.value === "google")) throw new Error("Google is not enabled in Hanko Social connections.")
      const verifier = generateCodeVerifier()
      setStoredCodeVerifier(verifier)
      window.sessionStorage.setItem(FLOW_KEY, "registration")
      await googleAction.run({ provider: "google", redirect_to: window.location.href, code_verifier: verifier })
    } catch (cause) {
      console.error("Google authentication failed", cause)
      setError(cause instanceof Error ? cause.message : "Google authentication could not be started.")
      setLoading(undefined)
    }
  }

  async function signInWithPasskey() {
    const hanko = hankoRef.current
    if (!hanko) return setError("Authentication is still loading. Please try again.")
    window.sessionStorage.removeItem(SERVER_REDIRECT_KEY)
    setError(undefined); setLoading("passkey")
    try {
      window.sessionStorage.setItem(FLOW_KEY, "login")
      const state = await hanko.createState("login", { cacheKey: LOGIN_CACHE, loadFromCache: false })
      if (state.name !== "login_init") throw new Error("Passkey login is not enabled in Hanko.")
      const passkeyAction = state.actions.webauthn_generate_request_options as unknown as EmptyAction | undefined
      if (!passkeyAction?.enabled) throw new Error("Passkey login is not enabled in Hanko.")
      await passkeyAction.run()
    } catch (cause) {
      console.error("Passkey authentication failed", cause)
      setError("No passkey was selected. Use Google once to create your account and register Touch ID.")
      setLoading(undefined)
    }
  }

  if (!api) return <div className="rounded-2xl border border-dashed bg-background/60 p-5"><div className="mb-2 flex items-center gap-2 text-sm font-medium"><Fingerprint className="size-4 text-primary" />Development workspace</div><p className="mb-4 text-xs leading-5 text-muted-foreground">Hanko is not configured, so this local build uses the isolated demo identity.</p><Button render={<Link href={next} />}>Enter demo workspace<ArrowRight /></Button></div>

  return <div className="space-y-3">
    <Button variant="outline" className="h-12 w-full justify-center bg-card text-sm shadow-sm" onClick={continueWithGoogle} disabled={Boolean(loading)}>{loading === "google" || loading === "callback" ? <LoaderCircle className="animate-spin" /> : <GoogleMark />}Create account with Google</Button>
    <Button className="h-12 w-full justify-center text-sm" onClick={signInWithPasskey} disabled={Boolean(loading)}>{loading === "passkey" ? <LoaderCircle className="animate-spin" /> : <Fingerprint />}{platformPasskey ? "Sign in with Touch ID" : "Sign in with a passkey"}</Button>
    <div className="flex items-start gap-2 rounded-xl bg-muted/55 px-3 py-2.5 text-[10px] leading-4 text-muted-foreground"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" /><span>Google verifies a new account once. Future access uses the passkey protected by your device.</span></div>
    {error && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs leading-5 text-destructive">{error}</p>}
  </div>
}

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.55h3.24c1.9-1.75 2.98-4.33 2.98-7.42Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.35l-3.24-2.55c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.63A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.93A6 6 0 0 1 6.08 12c0-.67.11-1.32.31-1.93V7.44H3.04A10 10 0 0 0 2 12c0 1.64.39 3.19 1.04 4.56l3.35-2.63Z"/><path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.44l3.35 2.63C7.18 7.7 9.39 5.94 12 5.94Z"/></svg>
}
