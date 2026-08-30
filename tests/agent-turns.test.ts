import { describe, expect, it } from "vitest"
import { isBareDecision } from "@/lib/backend/turns"

/**
 * The guard exists so that an approval on a pending escalation cannot arrive
 * disguised as a request or guidance turn — it has to be sent as its own turn,
 * which the voice console gates behind a click. What matters is that it stays
 * aligned with `src/agent/chat.classify` on the kernel side: anything the
 * kernel would read as a decision has to be caught here.
 */
describe("bare decision detection", () => {
  it("catches the words the kernel reads as a decision", () => {
    for (const text of ["approve", "yes", "ok", "Approve!", "  APPROVE  ", "do it", "reject", "no", "cancel", "sí", "dale", "apruebo"]) {
      expect(isBareDecision(text), text).toBe(true)
    }
  })

  it("catches a decision padded to the kernel's three-word limit", () => {
    expect(isBareDecision("yes please do")).toBe(true)
    expect(isBareDecision("no thanks")).toBe(true)
  })

  it("lets a real request through", () => {
    for (const text of [
      "find me a flight to Cordoba, cheapest you can",
      "how much is left on my mandate",
      "approve the cheapest one only if it is under a hundred dollars",
      "no airline with a layover in Panama please",
    ]) {
      expect(isBareDecision(text), text).toBe(false)
    }
  })

  it("does not trip on an empty string", () => {
    expect(isBareDecision("")).toBe(false)
    expect(isBareDecision("   ")).toBe(false)
  })
})
