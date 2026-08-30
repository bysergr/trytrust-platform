import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth/server"
import { listSites } from "@/lib/db/repository"
import { AppShell } from "./app-shell"

export async function ProtectedShell({ children, allowPasskeySetup = false }: { children: React.ReactNode; allowPasskeySetup?: boolean }) {
  const user = await getCurrentUser(); if (!user) redirect("/login")
  if (!allowPasskeySetup && !user.hasAccountPasskey && !user.isDemo) redirect("/security?setup=passkey")
  const sites = await listSites(user.id)
  return <AppShell user={user} sites={sites}>{children}</AppShell>
}
