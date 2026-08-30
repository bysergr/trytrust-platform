"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, ExternalLink, Globe2, Lock, Radio, Settings2 } from "lucide-react"
import { toast } from "sonner"
import type { SiteWithVersion } from "@/lib/types"
import { ArtifactFrame } from "./artifact-frame"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export function SiteDetail({ initialSite }: { initialSite: SiteWithVersion }) {
  const router = useRouter(), [site, setSite] = useState(initialSite), [open, setOpen] = useState(false)
  const defaultFields = useMemo(() => Object.fromEntries((site.version?.bindings ?? []).map((binding) => [binding.id, binding.fields])), [site.version])
  const [allowlist, setAllowlist] = useState<Record<string, string[]>>(site.status === "published" ? site.publicConfig.bindingAllowlist : defaultFields)
  const publicUrl = typeof window === "undefined" ? `/s/${site.slug}` : `${window.location.origin}/s/${site.slug}`

  async function publish() { const response = await fetch(`/api/sites/${site.id}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bindingAllowlist: allowlist }) }); if (!response.ok) return toast.error("Could not publish this site"); setSite({ ...site, ...(await response.json()) }); setOpen(false); toast.success("Public link is live"); router.refresh() }
  async function unpublish() { const response = await fetch(`/api/sites/${site.id}/unpublish`, { method: "POST" }); if (!response.ok) return toast.error("Could not unpublish this site"); setSite({ ...site, ...(await response.json()) }); toast.success("Public access removed"); router.refresh() }
  async function copy() { await navigator.clipboard.writeText(publicUrl); toast.success("Public link copied") }
  function toggle(binding: string, field: string) { setAllowlist((current) => ({ ...current, [binding]: current[binding]?.includes(field) ? current[binding].filter((item) => item !== field) : [...(current[binding] ?? []), field] })) }

  if (!site.version) return null
  return <main className="flex min-h-svh flex-col">
    <header className="surface sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
      <div className="min-w-0"><div className="flex items-center gap-2"><h1 className="truncate text-sm font-semibold">{site.title}</h1><Badge variant="outline" className={`font-mono text-[9px] uppercase ${site.status === "published" ? "border-primary/25 bg-primary/10 text-primary" : ""}`}>{site.status === "published" ? <Radio className="size-3 text-primary animate-pulse" /> : <Lock className="size-3" />}{site.status}</Badge></div><p className="mt-1 truncate text-[10px] text-muted-foreground">Version {site.version.version} · saved {new Date(site.updatedAt).toLocaleDateString()}</p></div>
      <div className="flex items-center gap-2">{site.status === "published" && <><Button variant="ghost" size="sm" onClick={copy}><Copy />Copy link</Button><Button variant="outline" size="sm" render={<a href={`/s/${site.slug}`} target="_blank" rel="noreferrer" />}><ExternalLink />Open</Button></>}
        <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button size="sm" />}><Globe2 />{site.status === "published" ? "Publishing" : "Publish"}</DialogTrigger><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Choose what becomes public</DialogTitle><DialogDescription>The page is anonymous, but live data remains private unless you explicitly allow each field.</DialogDescription></DialogHeader><div className="max-h-[48svh] space-y-3 overflow-y-auto py-2">{site.version.bindings.map((binding) => <div key={binding.id} className="rounded-2xl border p-4"><div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-medium">{binding.id}</p><p className="font-mono text-[9px] text-muted-foreground">{binding.source}</p></div><Settings2 className="size-4 text-muted-foreground" /></div><div className="flex flex-wrap gap-2">{binding.fields.map((field) => { const checked = allowlist[binding.id]?.includes(field); return <button key={field} onClick={() => toggle(binding.id, field)} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 font-mono text-[9px] transition ${checked ? "border-primary/30 bg-primary/8 text-primary" : "text-muted-foreground"}`}><span className={`grid size-3 place-items-center rounded-sm border ${checked ? "border-primary bg-primary text-primary-foreground" : ""}`}>{checked && <Check className="size-2.5" />}</span>{field}</button> })}</div></div>)}</div><DialogFooter>{site.status === "published" && <Button variant="destructive" onClick={unpublish}>Unpublish</Button>}<DialogClose render={<Button variant="outline" />}>Cancel</DialogClose><Button onClick={publish}>Publish selected data</Button></DialogFooter></DialogContent></Dialog>
      </div>
    </header>
    <div className="m-3 min-h-0 flex-1 overflow-hidden rounded-2xl border bg-card shadow-[0_24px_80px_-55px_rgba(20,50,38,.65)] sm:m-5"><ArtifactFrame html={site.version.html} dataUrl={`/api/sites/${site.id}/data`} className="h-full min-h-[calc(100svh-7.5rem)]" title={site.title} /></div>
  </main>
}

