import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth/server"
import { getSite } from "@/lib/db/repository"
import { ProtectedShell } from "@/components/layout/protected-shell"
import { SiteDetail } from "@/components/sites/site-detail"

export const metadata: Metadata = { title: "Site" }
export default async function SitePage({ params }: PageProps<"/sites/[id]">) { const user = await getCurrentUser(); if (!user) redirect("/login"); if (!user.hasAccountPasskey && !user.isDemo) redirect("/security?setup=passkey"); const { id } = await params, site = await getSite(user.id, id); if (!site) notFound(); return <ProtectedShell><SiteDetail initialSite={site} /></ProtectedShell> }
