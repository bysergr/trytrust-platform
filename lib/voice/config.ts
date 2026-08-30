/**
 * Shared between the client-secret route handler and the browser session so
 * the minted secret and the connection always agree on the model and voice.
 */

/** Reasoning-capable speech-to-speech model; the model cannot change mid-session. */
export const REALTIME_MODEL = "gpt-realtime-2.1"

/**
 * The voice sets the timbre only — language and accent come from the agent's
 * instructions (see lib/voice/agent.ts). `marin`, `coral`, `shimmer` and `sage`
 * read feminine; `cedar`, `ash`, `echo`, `ballad` and `verse` read masculine;
 * `alloy` is the most neutral.
 */
export const REALTIME_VOICE = "marin"
