import { z } from "zod"

export const bindingSourceSchema = z.enum([
  "analytics.summary",
  "analytics.timeseries",
  "analytics.byMerchant",
  "analytics.transactions",
  "agent.currentOffer",
])

export const dataBindingSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  source: bindingSourceSchema,
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  fields: z.array(z.string().regex(/^[a-zA-Z0-9_.-]{1,64}$/)).max(24).default([]),
  refreshSeconds: z.literal(15).default(15),
})

export const generatedArtifactSchema = z.object({
  title: z.string().min(1).max(80),
  description: z.string().max(240).default(""),
  html: z.string().min(1).max(150_000),
  bindings: z.array(dataBindingSchema).max(12).default([]),
})

export const agentChatRequestSchema = z.object({
  text: z.string().trim().min(1).max(2_000),
  sessionId: z.string().min(1).max(128).optional(),
})

export const siteCreateSchema = z.object({
  artifact: generatedArtifactSchema,
  sourceContext: z.record(z.string(), z.unknown()).default({}),
})

export const siteUpdateSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(240).optional(),
})

export const siteVersionSchema = z.object({
  artifact: generatedArtifactSchema,
  sourceContext: z.record(z.string(), z.unknown()).default({}),
})

export const publishSiteSchema = z.object({
  bindingAllowlist: z.record(z.string(), z.array(z.string()).max(24)).default({}),
})

export type BindingSource = z.infer<typeof bindingSourceSchema>
export type DataBinding = z.infer<typeof dataBindingSchema>
export type GeneratedArtifact = z.infer<typeof generatedArtifactSchema>

export type HankoUser = {
  id: string
  email: string
  name: string
  avatarUrl?: string | null
  isDemo?: boolean
}

export type Mandate = {
  mandate_id?: string
  id?: string
  jti: string
  status: string
  user_id?: string
  claims?: Record<string, unknown>
}

export type AgentRun = {
  run_id: string
  status: string
  node: string
  escalation_id?: string | null
  proposal?: Record<string, unknown> | null
  result?: Record<string, unknown> | null
}

export type AgentChatResponse = {
  sessionId: string
  replies: string[]
  run: AgentRun | null
  awaitingHuman: boolean
  artifact: GeneratedArtifact | null
}

export type AuditEvent = {
  seq?: number
  mandate_id?: string
  mandate_jti?: string
  type: string
  payload: Record<string, unknown>
  created_at: string
}

export type Transaction = {
  purchaseId: string
  mandateId?: string
  merchant: string
  offer: string
  amount: number
  currency: string
  status: "captured" | "rejected" | "escalated" | "compensated" | "pending"
  createdAt: string
  receiptId?: string
}

export type AnalyticsDataset = {
  range: string
  currency: string
  currencies: string[]
  summary: {
    capturedVolume: number
    capturedCount: number
    approvalRate: number
    averageTransaction: number
    totalAttempts: number
  }
  timeseries: Array<{ date: string; value: number; count: number }>
  byMerchant: Array<{ merchant: string; count: number; percentage: number; spend: number; spendShare: number }>
  statusDistribution: Array<{ status: string; count: number }>
  transactions: Transaction[]
  updatedAt: string
}

export type SiteRecord = {
  id: string
  ownerId: string
  title: string
  description: string
  slug: string
  status: "draft" | "published" | "archived"
  currentVersionId: string | null
  publicConfig: { bindingAllowlist: Record<string, string[]> }
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  deletedAt: string | null
}

export type SiteVersionRecord = {
  id: string
  siteId: string
  version: number
  html: string
  bindings: DataBinding[]
  sourceContext: Record<string, unknown>
  createdAt: string
}

export type SiteWithVersion = SiteRecord & { version: SiteVersionRecord | null }

