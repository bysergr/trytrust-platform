import { describe, expect, it } from "vitest"
import { buildArtifactDocument } from "@/lib/artifacts/runtime"
import { sanitizeArtifactHtml } from "@/lib/artifacts/sanitize"

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
