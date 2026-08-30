import { afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ generateContent: vi.fn() }))

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: mocks.generateContent }
  },
}))

import { generateArtifact, shouldGenerateArtifact } from "@/lib/artifacts/generate"

const originalApiKey = process.env.GEMINI_API_KEY

afterEach(() => {
  process.env.GEMINI_API_KEY = originalApiKey
  mocks.generateContent.mockReset()
})

describe("custom artifact generation flow", () => {
  it("detects a custom visual request and returns validated, sanitized HTML", async () => {
    process.env.GEMINI_API_KEY = "test-key"
    const request = "Crea una página visual custom titulada Ruta Esmeralda para comparar dos vuelos Bogotá–Miami."
    mocks.generateContent.mockResolvedValue({
      text: JSON.stringify({
        title: "Ruta Esmeralda",
        description: "Comparación visual custom de vuelos.",
        html: `<main class="route"><style>.route{color:#0f172a}</style><h1>Ruta Esmeralda</h1><p>VuelaYa · 142 USD</p><script>unsafe()</script><form><button>Pay</button></form></main>`,
        bindings: [{
          id: "offer-from-model",
          source: "agent.currentOffer",
          params: {},
          fields: ["title", "price", "currency"],
          refreshSeconds: 15,
        }],
      }),
    })

    expect(shouldGenerateArtifact(request, null)).toBe(true)
    const artifact = await generateArtifact({
      request,
      replies: ["Preparé la comparación visual solicitada."],
      proposal: { title: "VuelaYa", price: "142", currency: "USD" },
    })

    expect(artifact).toMatchObject({
      title: "Ruta Esmeralda",
      bindings: [{ id: "currentOffer", source: "agent.currentOffer" }],
    })
    expect(artifact.html).toMatch(/Ruta Esmeralda|VuelaYa|142/)
    expect(artifact.html).not.toMatch(/<script|<form|<button|unsafe\(\)/i)

    const call = mocks.generateContent.mock.calls[0]?.[0]
    expect(call.config).toMatchObject({ responseMimeType: "application/json", temperature: 0.35 })
    expect(call.contents).toContain(request)
    expect(call.contents).toContain("tailored specifically to the user's request")
  })

  it("does not generate HTML for a normal chat request", () => {
    expect(shouldGenerateArtifact("Busca un vuelo barato a Miami", { proposal: { price: 142 } })).toBe(false)
    expect(mocks.generateContent).not.toHaveBeenCalled()
  })
})
