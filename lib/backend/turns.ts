/**
 * Mirrors the bare affirmations `src/agent/chat.classify` treats as a decision
 * on a pending escalation.
 *
 * Its only job is to stop a `request` or `guidance` turn from resolving an
 * escalation by accident, so an approval has to arrive as an explicit
 * `approve` turn — which the voice console gates behind a click. It is not a
 * security boundary; the mandate is, and an approval re-runs the check before
 * paying rather than bypassing it.
 */
const DECISION_WORDS = new Set([
  "approve", "approved", "yes", "y", "ok", "okay", "go", "go ahead", "do it",
  "buy it", "confirm", "confirmed", "si", "sí", "dale", "aprobar", "apruebo",
  "adelante", "reject", "rejected", "no", "n", "cancel", "stop", "deny",
  "denied", "nope", "rechazar", "rechazo", "para", "detente",
])

export function isBareDecision(text: string) {
  const cleaned = text.toLowerCase().replace(/[^\w\s]/g, " ").trim().replace(/\s+/g, " ")
  const words = cleaned.split(" ")
  return DECISION_WORDS.has(cleaned) || (words.length <= 3 && DECISION_WORDS.has(words[0]))
}
