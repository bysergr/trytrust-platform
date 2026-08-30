import type { AnalyticsDataset, AuditEvent, Transaction } from "@/lib/types"

const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, all: Number.POSITIVE_INFINITY }

export function aggregateAnalytics(events: AuditEvent[], range = "30d", requestedCurrency?: string): AnalyticsDataset {
  const cutoff = Date.now() - (RANGE_DAYS[range] ?? 30) * 86_400_000
  const eventRows = events.filter((event) => Number.isFinite(cutoff) ? new Date(event.created_at).getTime() >= cutoff : true)
  const attempts = new Map<string, Transaction>()

  for (const event of eventRows.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())) {
    if (!event.type.startsWith("purchase.")) continue
    const payload = event.payload ?? {}
    const receipt = asRecord(payload.receipt)
    const purchaseId = String(payload.purchase_id ?? receipt.purchase_id ?? `event-${event.seq ?? attempts.size}`)
    const previous = attempts.get(purchaseId)
    const rawStatus = event.type.split(".")[1]
    const status = (["captured", "rejected", "escalated", "compensated"] as const).includes(rawStatus as never) ? rawStatus as Transaction["status"] : previous?.status ?? "pending"
    attempts.set(purchaseId, {
      purchaseId,
      mandateId: event.mandate_id ?? event.mandate_jti,
      merchant: String(receipt.merchant_id ?? payload.merchant_id ?? previous?.merchant ?? "Unknown merchant"),
      offer: String(receipt.title ?? receipt.offer_title ?? payload.offer_id ?? previous?.offer ?? "Purchase"),
      amount: number(receipt.amount ?? payload.amount ?? previous?.amount ?? 0),
      currency: String(receipt.currency ?? payload.currency ?? previous?.currency ?? "USD"),
      status,
      createdAt: event.created_at,
      receiptId: typeof receipt.receipt_id === "string" ? receipt.receipt_id : previous?.receiptId,
    })
  }

  const allTransactions = [...attempts.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const currencies = [...new Set(allTransactions.map((item) => item.currency))].sort()
  const currency = requestedCurrency && currencies.includes(requestedCurrency) ? requestedCurrency : currencies[0] ?? requestedCurrency ?? "USD"
  const transactions = allTransactions.filter((item) => item.currency === currency)
  const captured = transactions.filter((item) => item.status === "captured")
  const capturedVolume = sum(captured.map((item) => item.amount))

  const byDate = new Map<string, { date: string; value: number; count: number }>()
  for (const transaction of captured) {
    const date = transaction.createdAt.slice(0, 10)
    const point = byDate.get(date) ?? { date, value: 0, count: 0 }
    point.value += transaction.amount; point.count += 1; byDate.set(date, point)
  }

  const merchantRows = new Map<string, { merchant: string; count: number; spend: number }>()
  for (const transaction of captured) {
    const row = merchantRows.get(transaction.merchant) ?? { merchant: transaction.merchant, count: 0, spend: 0 }
    row.count += 1; row.spend += transaction.amount; merchantRows.set(transaction.merchant, row)
  }

  const statusDistribution = ["captured", "rejected", "escalated", "compensated"].map((status) => ({ status, count: transactions.filter((item) => item.status === status).length }))
  const totalAttempts = transactions.length
  return {
    range, currency, currencies: currencies.length ? currencies : [currency],
    summary: {
      capturedVolume: round(capturedVolume), capturedCount: captured.length,
      approvalRate: totalAttempts ? round((captured.length / totalAttempts) * 100) : 0,
      averageTransaction: captured.length ? round(capturedVolume / captured.length) : 0,
      totalAttempts,
    },
    timeseries: [...byDate.values()].map((point) => ({ ...point, value: round(point.value) })),
    byMerchant: [...merchantRows.values()].sort((a, b) => b.spend - a.spend).map((row) => ({ ...row, spend: round(row.spend), percentage: captured.length ? round((row.count / captured.length) * 100) : 0, spendShare: capturedVolume ? round((row.spend / capturedVolume) * 100) : 0 })),
    statusDistribution,
    transactions,
    updatedAt: new Date().toISOString(),
  }
}

function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function number(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0 }
function round(value: number) { return Math.round(value * 100) / 100 }
function sum(values: number[]) { return values.reduce((total, value) => total + value, 0) }

