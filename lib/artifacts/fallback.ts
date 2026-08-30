import type { GeneratedArtifact } from "@/lib/types"

export function fallbackArtifact(context?: Record<string, unknown>): GeneratedArtifact {
  const proposal = (context?.proposal ?? {}) as Record<string, unknown>
  const result = (context?.result ?? {}) as Record<string, unknown>
  const receipt = (result.receipt ?? {}) as Record<string, unknown>
  const title = String(receipt.title ?? proposal.title ?? "Trust activity overview")
  return {
    title,
    description: "A live, permissioned view generated from your TryTrust activity.",
    bindings: [
      { id: "summary", source: "analytics.summary", params: {}, fields: ["capturedVolume", "capturedCount", "approvalRate", "averageTransaction"], refreshSeconds: 15 },
      { id: "timeseries", source: "analytics.timeseries", params: {}, fields: ["date", "value", "count"], refreshSeconds: 15 },
      { id: "transactions", source: "analytics.transactions", params: {}, fields: ["merchant", "offer", "amount", "status"], refreshSeconds: 15 },
    ],
    html: `<main class="page"><style>
      .page{padding:clamp(24px,5vw,64px);max-width:1120px;margin:auto;font-family:'Inter',system-ui,-apple-system,sans-serif}.eyebrow{font:600 11px/1 'Inter',system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#2563eb}.hero{display:flex;align-items:end;justify-content:space-between;gap:24px;padding-bottom:28px;border-bottom:1px solid #e2e8f0}.hero h1{font:600 clamp(32px,5vw,56px)/1.02 'Inter',system-ui,sans-serif;letter-spacing:-.04em;max-width:720px;margin:16px 0 0;color:#0f172a}.live{font-size:12px;color:#64748b;font-family:'Inter',sans-serif}.dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#2563eb;margin-right:7px;box-shadow:0 0 0 5px rgba(37,99,235,0.18)}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#e2e8f0;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;margin:28px 0}.metric{background:#fff;padding:22px}.metric span{display:block;color:#64748b;font-size:12px;font-weight:500;margin-bottom:16px;font-family:'Inter',sans-serif}.metric strong{font:600 28px/1 'Inter',sans-serif;letter-spacing:-.03em;color:#0f172a}.panel-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:18px}.panel{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:24px;box-shadow:0 4px 20px -8px rgba(37,99,235,0.06)}.panel h2{font:600 17px/1.2 'Inter',sans-serif;letter-spacing:-.02em;margin:0 0 20px;color:#0f172a}.tt-chart{border-bottom:1px solid #e2e8f0} @media(max-width:760px){.hero{align-items:start;flex-direction:column}.grid{grid-template-columns:1fr 1fr}.panel-grid{grid-template-columns:1fr}.page{padding:24px}.metric strong{font-size:22px}}
    </style><header class="hero"><div><div class="eyebrow">TryTrust / live brief</div><h1>${escapeHtml(title)}</h1></div><div class="live"><span class="dot"></span><span data-tt-updated>Connecting…</span></div></header><section class="grid"><div class="metric"><span>Captured volume</span><strong data-tt-bind="summary.capturedVolume" data-tt-format="currency">—</strong></div><div class="metric"><span>Completed</span><strong data-tt-bind="summary.capturedCount" data-tt-format="number">—</strong></div><div class="metric"><span>Approval rate</span><strong data-tt-bind="summary.approvalRate" data-tt-format="percent">—</strong></div><div class="metric"><span>Average</span><strong data-tt-bind="summary.averageTransaction" data-tt-format="currency">—</strong></div></section><section class="panel-grid"><div class="panel"><h2>Transactions over time</h2><div class="tt-chart" data-tt-bind="timeseries" data-tt-chart="bars"></div></div><div class="panel"><h2>Recent transactions</h2><table data-tt-bind="transactions"><thead><tr><th>Merchant</th><th>Offer</th><th>Amount</th><th>Status</th></tr></thead><tbody></tbody></table></div></section></main>`,
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]!)
}
