import { describe, expect, it } from "vitest"
import { buildArtifactDocument } from "@/lib/artifacts/runtime"
import { sanitizeArtifactHtml } from "@/lib/artifacts/sanitize"
import { shouldGenerateArtifact } from "@/lib/artifacts/generate"

describe("generated artifact security", () => {
  it("removes executable and navigational markup", () => {
    const html = sanitizeArtifactHtml(`
      <section onclick="steal()"><script>alert(1)</script>
      <a href="javascript:steal()">Bad link</a><img src="https://tracking.test/a.png">
      <form action="https://evil.test"><input name="secret"></form></section>
    `)
    expect(html).not.toMatch(/script|onclick|javascript:|https:\/\/|<form|<input/i)
  })

  it("wraps content in a strict CSP and the fixed application runtime", () => {
    const document = buildArtifactDocument("<main><span data-bind=\"summary.capturedCount\"></span></main>")
    expect(document).toContain("connect-src 'none'")
    expect(document).toContain("form-action 'none'")
    expect(document).toContain("trytrust:data")
  })
})

describe("artifact generation intent", () => {
  it("does not render HTML for ordinary conversation or purchase proposals", () => {
    const proposal = { proposal: { title: "BOG to MIA" } }
    expect(shouldGenerateArtifact("Find a direct flight to Miami under $180", proposal)).toBe(false)
    expect(shouldGenerateArtifact("How much have I spent?", proposal)).toBe(false)
    expect(shouldGenerateArtifact("Show my merchant spend", proposal)).toBe(false)
  })

  it("renders only when the user explicitly requests a visual artifact", () => {
    expect(shouldGenerateArtifact("Build a transaction intelligence dashboard", null)).toBe(true)
    expect(shouldGenerateArtifact("Crea una página visual con mis compras", null)).toBe(true)
    expect(shouldGenerateArtifact("Visualiza estos datos en una gráfica", null)).toBe(true)
  })
})
