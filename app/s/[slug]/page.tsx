import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getPublicSite } from "@/lib/db/repository"
import { ArtifactFrame } from "@/components/sites/artifact-frame"
import { Logo } from "@/components/layout/app-shell"

export const metadata: Metadata = { title: "Shared site", robots: { index: false, follow: false } }
export default async function PublicSitePage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params, site = await getPublicSite(slug); if (!site?.version) notFound(); return <main className="min-h-svh bg-[#f7f7fc]"><header className="flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur-xl"><div className="flex items-center gap-2"><Logo size="sm" /><span className="text-muted-foreground">/</span><span className="max-w-48 truncate text-xs text-muted-foreground">{site.title}</span></div><div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.12em] text-muted-foreground"><span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />Published view</div></header><ArtifactFrame html={site.version.html} dataUrl={`/api/public/sites/${site.slug}/data`} className="min-h-[calc(100svh-3.5rem)]" title={site.title} /></main> }
