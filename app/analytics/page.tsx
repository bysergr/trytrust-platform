import type { Metadata } from "next"
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard"
import { ProtectedShell } from "@/components/layout/protected-shell"

export const metadata: Metadata = { title: "Analytics" }
export default function AnalyticsPage() { return <ProtectedShell><AnalyticsDashboard /></ProtectedShell> }

