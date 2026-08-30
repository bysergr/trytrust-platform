import { and, desc, eq, isNull, max } from "drizzle-orm"
import { db } from "./client"
import { agentSessions, sites, siteVersions, users } from "./schema"
import type { GeneratedArtifact, HankoUser, SiteRecord, SiteVersionRecord, SiteWithVersion } from "@/lib/types"

type MemoryState = {
  users: Map<string, HankoUser>
  sessions: Map<string, { ownerId: string; backendSessionId: string; agentId: string; mandateJti: string }>
  sites: Map<string, SiteRecord>
  versions: Map<string, SiteVersionRecord[]>
}

const globalMemory = globalThis as unknown as { tryTrustMemory?: MemoryState }
const memory: MemoryState = globalMemory.tryTrustMemory ?? {
  users: new Map(), sessions: new Map(), sites: new Map(), versions: new Map(),
}
if (process.env.NODE_ENV !== "production") globalMemory.tryTrustMemory = memory

const iso = (value: Date | string | null) => value instanceof Date ? value.toISOString() : value

function memoryStoreEnabled() {
  if (!db && process.env.NODE_ENV === "production") throw new Error("DATABASE_NOT_CONFIGURED")
  return !db
}

function rowSite(row: typeof sites.$inferSelect): SiteRecord {
  return { ...row, status: row.status as SiteRecord["status"], createdAt: iso(row.createdAt)!, updatedAt: iso(row.updatedAt)!, publishedAt: iso(row.publishedAt), deletedAt: iso(row.deletedAt) }
}

function rowVersion(row: typeof siteVersions.$inferSelect): SiteVersionRecord {
  return { ...row, createdAt: iso(row.createdAt)! }
}

export async function syncUser(user: HankoUser) {
  if (memoryStoreEnabled()) { memory.users.set(user.id, user); return }
  await db!.insert(users).values({ id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl })
    .onConflictDoUpdate({ target: users.id, set: { email: user.email, name: user.name, avatarUrl: user.avatarUrl, updatedAt: new Date() } })
}

export async function ownSession(ownerId: string, backendSessionId: string) {
  if (memoryStoreEnabled()) return memory.sessions.get(`${ownerId}:${backendSessionId}`) ?? null
  return (await db!.select().from(agentSessions).where(and(eq(agentSessions.ownerId, ownerId), eq(agentSessions.backendSessionId, backendSessionId))).limit(1))[0] ?? null
}

export async function saveSession(ownerId: string, backendSessionId: string, agentId: string, mandateJti: string) {
  if (memoryStoreEnabled()) { memory.sessions.set(`${ownerId}:${backendSessionId}`, { ownerId, backendSessionId, agentId, mandateJti }); return }
  await db!.insert(agentSessions).values({ ownerId, backendSessionId, agentId, mandateJti })
    .onConflictDoUpdate({ target: [agentSessions.ownerId, agentSessions.backendSessionId], set: { updatedAt: new Date(), agentId, mandateJti } })
}

export async function listSites(ownerId: string) {
  if (memoryStoreEnabled()) return [...memory.sites.values()].filter((site) => site.ownerId === ownerId && !site.deletedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return (await db!.select().from(sites).where(and(eq(sites.ownerId, ownerId), isNull(sites.deletedAt))).orderBy(desc(sites.updatedAt))).map(rowSite)
}

export async function getSite(ownerId: string, id: string): Promise<SiteWithVersion | null> {
  const site = memoryStoreEnabled() ? memory.sites.get(id) : (await db!.select().from(sites).where(and(eq(sites.id, id), eq(sites.ownerId, ownerId), isNull(sites.deletedAt))).limit(1))[0]
  if (!site || ("ownerId" in site && site.ownerId !== ownerId)) return null
  return withCurrentVersion(rowSite(site as typeof sites.$inferSelect))
}

export async function getPublicSite(slug: string): Promise<SiteWithVersion | null> {
  const site = memoryStoreEnabled() ? [...memory.sites.values()].find((item) => item.slug === slug && item.status === "published" && !item.deletedAt) : (await db!.select().from(sites).where(and(eq(sites.slug, slug), eq(sites.status, "published"), isNull(sites.deletedAt))).limit(1))[0]
  return site ? withCurrentVersion(rowSite(site as typeof sites.$inferSelect)) : null
}

async function withCurrentVersion(site: SiteRecord): Promise<SiteWithVersion> {
  if (!site.currentVersionId) return { ...site, version: null }
  if (memoryStoreEnabled()) return { ...site, version: memory.versions.get(site.id)?.find((version) => version.id === site.currentVersionId) ?? null }
  const version = (await db!.select().from(siteVersions).where(eq(siteVersions.id, site.currentVersionId)).limit(1))[0]
  return { ...site, version: version ? rowVersion(version) : null }
}

export async function createSite(ownerId: string, artifact: GeneratedArtifact, sourceContext: Record<string, unknown>) {
  const siteId = crypto.randomUUID(), versionId = crypto.randomUUID(), now = new Date().toISOString()
  const slug = await uniqueSlug(artifact.title)
  if (memoryStoreEnabled()) {
    const site: SiteRecord = { id: siteId, ownerId, title: artifact.title, description: artifact.description, slug, status: "draft", currentVersionId: versionId, publicConfig: { bindingAllowlist: {} }, createdAt: now, updatedAt: now, publishedAt: null, deletedAt: null }
    const version: SiteVersionRecord = { id: versionId, siteId, version: 1, html: artifact.html, bindings: artifact.bindings, sourceContext, createdAt: now }
    memory.sites.set(siteId, site); memory.versions.set(siteId, [version]); return { ...site, version }
  }
  return db!.transaction(async (tx) => {
    const [siteRow] = await tx.insert(sites).values({ id: siteId, ownerId, title: artifact.title, description: artifact.description, slug }).returning()
    const [versionRow] = await tx.insert(siteVersions).values({ id: versionId, siteId, version: 1, html: artifact.html, bindings: artifact.bindings, sourceContext }).returning()
    await tx.update(sites).set({ currentVersionId: versionId }).where(eq(sites.id, siteId))
    return { ...rowSite({ ...siteRow, currentVersionId: versionId }), version: rowVersion(versionRow) }
  })
}

export async function addSiteVersion(ownerId: string, siteId: string, artifact: GeneratedArtifact, sourceContext: Record<string, unknown>) {
  const site = await getSite(ownerId, siteId); if (!site) throw new Error("NOT_FOUND")
  const id = crypto.randomUUID(), createdAt = new Date().toISOString()
  if (memoryStoreEnabled()) {
    const list = memory.versions.get(siteId) ?? []
    const version = { id, siteId, version: list.length + 1, html: artifact.html, bindings: artifact.bindings, sourceContext, createdAt }
    list.push(version); memory.versions.set(siteId, list); memory.sites.set(siteId, { ...site, title: artifact.title, description: artifact.description, currentVersionId: id, updatedAt: createdAt }); return version
  }
  return db!.transaction(async (tx) => {
    const [{ value }] = await tx.select({ value: max(siteVersions.version) }).from(siteVersions).where(eq(siteVersions.siteId, siteId))
    const [version] = await tx.insert(siteVersions).values({ id, siteId, version: (value ?? 0) + 1, html: artifact.html, bindings: artifact.bindings, sourceContext }).returning()
    await tx.update(sites).set({ title: artifact.title, description: artifact.description, currentVersionId: id, updatedAt: new Date() }).where(and(eq(sites.id, siteId), eq(sites.ownerId, ownerId)))
    return rowVersion(version)
  })
}

export async function updateSite(ownerId: string, siteId: string, values: { title?: string; description?: string }) {
  const site = await getSite(ownerId, siteId); if (!site) throw new Error("NOT_FOUND")
  if (memoryStoreEnabled()) { const next = { ...site, ...values, updatedAt: new Date().toISOString() }; delete (next as Partial<SiteWithVersion>).version; memory.sites.set(siteId, next); return next }
  const [updated] = await db!.update(sites).set({ ...values, updatedAt: new Date() }).where(and(eq(sites.id, siteId), eq(sites.ownerId, ownerId))).returning()
  return rowSite(updated)
}

export async function publishSite(ownerId: string, siteId: string, bindingAllowlist: Record<string, string[]>) {
  const site = await getSite(ownerId, siteId); if (!site) throw new Error("NOT_FOUND")
  const publishedAt = new Date().toISOString(), publicConfig = { bindingAllowlist }
  if (memoryStoreEnabled()) { const next = { ...site, status: "published" as const, publicConfig, publishedAt, updatedAt: publishedAt }; delete (next as Partial<SiteWithVersion>).version; memory.sites.set(siteId, next); return next }
  const [updated] = await db!.update(sites).set({ status: "published", publicConfig, publishedAt: new Date(), updatedAt: new Date() }).where(and(eq(sites.id, siteId), eq(sites.ownerId, ownerId))).returning()
  return rowSite(updated)
}

export async function unpublishSite(ownerId: string, siteId: string) {
  const site = await getSite(ownerId, siteId); if (!site) throw new Error("NOT_FOUND")
  if (memoryStoreEnabled()) { const next = { ...site, status: "draft" as const, publishedAt: null, updatedAt: new Date().toISOString() }; delete (next as Partial<SiteWithVersion>).version; memory.sites.set(siteId, next); return next }
  const [updated] = await db!.update(sites).set({ status: "draft", publishedAt: null, updatedAt: new Date() }).where(and(eq(sites.id, siteId), eq(sites.ownerId, ownerId))).returning()
  return rowSite(updated)
}

async function uniqueSlug(title: string) {
  const base = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 44) || "site"
  return `${base}-${crypto.randomUUID().slice(0, 6)}`
}
