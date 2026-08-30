import { describe, expect, it } from "vitest"
import { aggregateAnalytics } from "@/lib/analytics/aggregate"
import type { AuditEvent } from "@/lib/types"

describe("analytics aggregation", () => {
  it("keeps monetary totals separated by currency", () => {
    const events: AuditEvent[] = [
      event("p1", "captured", "10.00", "USD", "Merchant A"),
      event("p2", "rejected", "40.00", "USD", "Merchant B"),
      event("p3", "captured", "50000", "COP", "Merchant A"),
    ]
    const usd = aggregateAnalytics(events, "all", "USD")
    const cop = aggregateAnalytics(events, "all", "COP")
    expect(usd.currencies).toEqual(["COP", "USD"])
    expect(usd).toMatchObject({ currency: "USD", summary: { capturedVolume: 10, capturedCount: 1, approvalRate: 50 } })
    expect(cop).toMatchObject({ currency: "COP", summary: { capturedVolume: 50000, capturedCount: 1, approvalRate: 100 } })
  })
})

function event(id: string, status: string, amount: string, currency: string, merchant: string): AuditEvent {
  return {
    seq: Number(id.slice(1)), type: `purchase.${status}`, created_at: "2026-08-20T12:00:00.000Z",
    payload: { purchase_id: id, amount, currency, merchant_id: merchant, offer_id: `offer-${id}` },
  }
}
