import { describe, expect, it } from "vitest"
import { publicBindingPayload } from "@/lib/analytics/public"

describe("public site binding allowlist", () => {
  it("returns only explicitly published bindings and fields", () => {
    const payload = {
      summary: [{ currency: "USD", capturedVolume: 210, mandateJti: "private" }],
      transactions: [{ id: "pur_1", amount: 210, currency: "USD", receiptId: "private-receipt" }],
      currentOffer: { title: "Flight", merchantId: "private-merchant" },
    }
    expect(publicBindingPayload(payload, {
      summary: ["currency", "capturedVolume"],
      transactions: ["amount", "currency"],
    })).toEqual({
      summary: [{ currency: "USD", capturedVolume: 210 }],
      transactions: [{ amount: 210, currency: "USD" }],
    })
  })
})
