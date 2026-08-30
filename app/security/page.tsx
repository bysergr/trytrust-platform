import type { Metadata } from "next"
import { KeyRound } from "lucide-react"
import { HankoProfile } from "@/components/auth/hanko-profile"
import { ProtectedShell } from "@/components/layout/protected-shell"
import { getCurrentUser } from "@/lib/auth/server"

export const metadata: Metadata = { title: "Security & passkeys" }

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ setup?: string; next?: string }> }) {
  const user = await getCurrentUser()
  const params = await searchParams
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/"
  return <ProtectedShell allowPasskeySetup><main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
    <div className="mb-8 flex items-start gap-4"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"><KeyRound className="size-5" /></div><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">Account security</p><h1 className="editorial-title mt-1 text-4xl font-medium">Passkeys & profile</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Manage the credential that signs you in to TryTrust. Mandate authorization remains a separate WebAuthn credential.</p></div></div>
    <section className="surface rounded-3xl border p-5 sm:p-8"><HankoProfile demo={user?.isDemo} setup={params.setup === "passkey" || !user?.hasAccountPasskey} next={next} /></section>
  </main></ProtectedShell>
}
