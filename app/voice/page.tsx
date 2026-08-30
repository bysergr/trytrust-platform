import { ProtectedShell } from "@/components/layout/protected-shell"
import { VoiceConsole } from "@/components/voice/voice-console"

export const metadata = { title: "Voice · TryTrust" }

export default function VoicePage() {
  return <ProtectedShell><VoiceConsole /></ProtectedShell>
}
