import "server-only"
import { getAuditEvents, getConversationAudit, getMandates } from "@/lib/backend/client"
import { aggregateAnalytics } from "./aggregate"

export async function analyticsForUser(userId: string, range = "30d", currency?: string) {
  const mandates = await getMandates(userId)
  const events = (await Promise.all(mandates.map((mandate) => getAuditEvents(mandate).catch(() => [])))).flat()
  return aggregateAnalytics(events, range, currency)
}

export async function analyticsForAgent(userId: string, range = "30d", currency?: string) {
  return aggregateAnalytics(await getConversationAudit(userId), range, currency)
}

export function bindingPayload(dataset: Awaited<ReturnType<typeof analyticsForUser>>, currentOffer?: Record<string, unknown>) {
  return {
    summary: dataset.summary,
    timeseries: dataset.timeseries,
    byMerchant: dataset.byMerchant,
    transactions: dataset.transactions,
    currentOffer: currentOffer ?? null,
    updatedAt: dataset.updatedAt,
  }
}
