import { AgentWorkspace } from "@/components/agent/agent-workspace"
import { ProtectedShell } from "@/components/layout/protected-shell"

export default function Home() {
  return <ProtectedShell><AgentWorkspace /></ProtectedShell>
}
