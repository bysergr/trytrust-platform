import type { Metadata } from "next"
import { ShieldCheck } from "lucide-react"
import { HankoAuth } from "@/components/auth/hanko-auth"
import { Logo } from "@/components/layout/app-shell"

export const metadata: Metadata = { title: "Sign in" }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  return <main className="relative grid min-h-svh overflow-hidden lg:grid-cols-[1.12fr_.88fr]">
    <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#080d21] via-[#0d1738] to-[#12234e] p-12 text-[#f8fafc] lg:flex">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(#fff2 1px,transparent 1px),linear-gradient(90deg,#fff2 1px,transparent 1px)", backgroundSize: "64px 64px" }} />
      <div className="absolute -left-20 -top-20 size-80 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="absolute -bottom-20 -right-20 size-80 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="relative flex items-center"><Logo size="lg" className="[&_span:first-child]:text-white" /></div>
      <div className="relative max-w-2xl enter"><p className="mb-6 font-mono text-xs uppercase tracking-[.18em] text-[#bfdbfe]">Permission before purchase</p><h1 className="editorial-title text-6xl font-medium xl:text-7xl">Let your agent move fast—inside boundaries you signed.</h1><div className="mt-10 flex items-center gap-3 border-t border-white/20 pt-6 text-sm text-[#e0e7ff]"><ShieldCheck className="size-5 text-blue-400" /><span>Every proposal passes a deterministic gate. Every decision leaves evidence.</span></div></div>
      <p className="relative font-mono text-[10px] uppercase tracking-[.14em] text-white/45">trytrust.lat · Bogotá / 2026</p>
    </section>
    <section className="flex min-h-svh items-center justify-center p-5 sm:p-10"><div className="surface enter-delay w-full max-w-md rounded-3xl border p-6 shadow-[0_35px_100px_-60px_rgba(20,40,90,.5)] sm:p-9">
      <div className="mb-10 flex items-center lg:hidden"><Logo size="lg" /></div>
      <p className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">Passwordless access</p><h2 className="editorial-title mt-3 text-4xl font-medium">Welcome to your agent.</h2><p className="mb-8 mt-4 text-sm leading-6 text-muted-foreground">Create your account once with Google. After that, return with Touch ID—no passwords or passcodes.</p>
      <HankoAuth next={safeNext(next)} />
      <p className="mt-8 text-center text-[10px] leading-5 text-muted-foreground">By continuing, you acknowledge that AI proposals are suggestions. Your signed mandate remains the authority.</p>
    </div></section>
  </main>
}

function safeNext(value?: string) { return value?.startsWith("/") && !value.startsWith("//") ? value : "/" }
