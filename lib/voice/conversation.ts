import type { AgentRun } from "@/lib/types"

/**
 * The kernel's session id, held in the browser.
 *
 * `/api/agent/chat` is stateful behind the scenes — a run is checkpointed
 * against a session — so every turn after the first has to carry the id back or
 * the agent starts a fresh run instead of answering the one it is parked on.
 * The voice tools run in the browser, so this is where that id lives.
 *
 * The console reads the same store to show what the *kernel* thinks is
 * happening, which is not always what the agent just said out loud.
 */
export type ConversationState = {
  sessionId: string | null
  run: AgentRun | null
  awaitingHuman: boolean
}

const EMPTY: ConversationState = { sessionId: null, run: null, awaitingHuman: false }

let state: ConversationState = EMPTY
const listeners = new Set<() => void>()

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getConversation(): ConversationState {
  return state
}

/** The snapshot the server renders with, before the browser has any state. */
export function getServerConversation(): ConversationState {
  return EMPTY
}

export function recordTurn(response: { sessionId: string; run: AgentRun | null; awaitingHuman: boolean }) {
  state = { sessionId: response.sessionId, run: response.run, awaitingHuman: response.awaitingHuman }
  for (const listener of listeners) listener()
}

/** New voice session, new conversation — the old run stays in the kernel. */
export function resetConversation() {
  state = EMPTY
  for (const listener of listeners) listener()
}
