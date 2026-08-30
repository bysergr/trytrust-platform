"use client"

import { useState } from "react"
import { Fingerprint, LockKeyhole, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function MandateOnboarding({ onReady }: { onReady: () => void }) {
  const [step, setStep] = useState(0), [working, setWorking] = useState(false)
  async function setup() {
    if (!window.PublicKeyCredential && process.env.NODE_ENV === "production") return toast.error("This browser does not support passkeys")
    setWorking(true)
    try {
      const begin = await post("/api/onboarding/passkey/begin")
      if (!begin.demo) {
        const credential = await navigator.credentials.create({ publicKey: creationOptions(begin.options) })
        if (!credential) throw new Error("Passkey creation was cancelled")
        await post("/api/onboarding/passkey/complete", { credential: serializeCredential(credential as PublicKeyCredential) })
      }
      setStep(1)
      const draft = await post("/api/onboarding/mandate/create")
      if (!draft.demo) {
        const assertion = await navigator.credentials.get({ publicKey: requestOptions(draft.options) })
        if (!assertion) throw new Error("Mandate signature was cancelled")
        await post("/api/onboarding/mandate/activate", { credential: serializeCredential(assertion as PublicKeyCredential) })
      }
      setStep(2); toast.success("Your mandate is active"); window.setTimeout(onReady, 500)
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not create your mandate") }
    finally { setWorking(false) }
  }
  return <main className="grid min-h-[calc(100svh-3.5rem)] place-items-center p-5 md:min-h-svh"><div className="surface enter w-full max-w-xl rounded-3xl border p-6 shadow-[0_30px_90px_-55px_rgba(20,50,38,.7)] sm:p-10">
    <Badge variant="outline" className="mb-6 border-primary/20 bg-primary/5 font-mono text-[9px] uppercase tracking-[.12em] text-primary">One-time setup</Badge>
    <h1 className="editorial-title max-w-md text-4xl font-medium sm:text-5xl">Give your agent boundaries it cannot cross.</h1>
    <p className="mt-5 max-w-lg text-sm leading-6 text-muted-foreground">Your account passkey signs you in. A separate mandate passkey signs the exact spending limits below, so neither TryTrust nor the agent can silently widen them.</p>
    <div className="my-8 grid gap-3 sm:grid-cols-3">{[{ icon: Fingerprint, title: "Register", copy: "Create a signing credential" }, { icon: LockKeyhole, title: "Define", copy: "$250 per purchase · $1,500 total" }, { icon: ShieldCheck, title: "Activate", copy: "Approve flights and retail only" }].map((item, index) => <div key={item.title} className={`rounded-2xl border p-4 transition ${step >= index ? "border-primary/25 bg-primary/[.04]" : "bg-card/50"}`}><item.icon className={`mb-5 size-5 ${step >= index ? "text-primary" : "text-muted-foreground"}`} /><div className="text-sm font-medium">{item.title}</div><div className="mt-1 text-[11px] leading-4 text-muted-foreground">{item.copy}</div></div>)}</div>
    <Button size="lg" className="w-full sm:w-auto" onClick={setup} disabled={working}>{working ? "Waiting for your passkey…" : step === 0 ? "Create secure mandate" : "Continue setup"}<Fingerprint /></Button>
    <p className="mt-4 font-mono text-[9px] leading-4 text-muted-foreground">Passkey gestures require a compatible device and the same registered domain. No card data is stored.</p>
  </div></main>
}

async function post(url: string, body?: unknown) { const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Request failed"); return data }
function decode(value: string) { const base64 = value.replace(/-/g, "+").replace(/_/g, "/"); return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)).buffer }
function encode(value: BufferSource) { const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength); return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") }
function creationOptions(raw: Record<string, unknown>) {
  const source = (raw.publicKey ?? raw) as Record<string, unknown>, user = source.user as Record<string, unknown>
  const excluded = source.excludeCredentials as Array<Record<string, unknown>> | undefined
  return { ...source, challenge: decode(String(source.challenge)), user: { ...user, id: decode(String(user.id)) }, excludeCredentials: excluded?.map((item) => ({ ...item, id: decode(String(item.id)) })) } as PublicKeyCredentialCreationOptions
}
function requestOptions(raw: Record<string, unknown>) {
  const source = (raw.publicKey ?? raw) as Record<string, unknown>, allowed = source.allowCredentials as Array<Record<string, unknown>> | undefined
  return { ...source, challenge: decode(String(source.challenge)), allowCredentials: allowed?.map((item) => ({ ...item, id: decode(String(item.id)) })) } as PublicKeyCredentialRequestOptions
}
function serializeCredential(credential: PublicKeyCredential) {
  const response = credential.response
  const base = { clientDataJSON: encode(response.clientDataJSON) }
  const assertion = response as AuthenticatorAssertionResponse
  const payload = response instanceof AuthenticatorAttestationResponse
    ? { ...base, attestationObject: encode(response.attestationObject), transports: response.getTransports() }
    : { ...base, authenticatorData: encode(assertion.authenticatorData), signature: encode(assertion.signature), userHandle: assertion.userHandle ? encode(assertion.userHandle) : null }
  return { id: credential.id, rawId: encode(credential.rawId), type: credential.type, clientExtensionResults: credential.getClientExtensionResults(), response: payload }
}
