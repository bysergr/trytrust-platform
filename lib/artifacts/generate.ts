import { GoogleGenAI } from "@google/genai"
import { generatedArtifactSchema, type GeneratedArtifact } from "@/lib/types"
import { sanitizeArtifactHtml } from "./sanitize"
import { fallbackArtifact } from "./fallback"

const SYSTEM = `You are TryTrust's presentation designer. Turn an agent result into a polished, responsive, self-contained HTML/CSS view tailored specifically to the user's request.
Return JSON only with title, description, html, and bindings.
Never emit JavaScript, forms, links, images, iframes, remote assets, instructions, payment controls, or claims not present in context.
Reflect the requested subject, hierarchy, format, and relevant facts. Do not default to a transaction dashboard, and only include data bindings that serve the request.
HTML may bind trusted live data with data-tt-bind attributes. Available paths: summary.capturedVolume, summary.capturedCount, summary.approvalRate, summary.averageTransaction, timeseries, byMerchant, transactions, currentOffer.
For charts use a container with data-tt-bind="timeseries" or "byMerchant" and data-tt-chart="bars". For transaction tables use a table with data-tt-bind="transactions" and a tbody.
Bindings sources are restricted to analytics.summary, analytics.timeseries, analytics.byMerchant, analytics.transactions, agent.currentOffer. refreshSeconds must equal 15.
Always use Inter font for typography ('Inter', -apple-system, system-ui, sans-serif), clean modern slate/graphite neutrals, professional high-contrast blue accents (#2563eb, #1d4ed8, #3b82f6), sleek card borders, excellent mobile layout, and accessible contrast.`

export async function generateArtifact(context: Record<string, unknown>): Promise<GeneratedArtifact> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY
  if (!apiKey) return fallbackArtifact(context)

  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      contents: `${SYSTEM}\n\nAgent context:\n${JSON.stringify(context).slice(0, 24_000)}`,
      config: { responseMimeType: "application/json", temperature: 0.35 },
    })
    const parsed = generatedArtifactSchema.parse(JSON.parse(response.text ?? "{}"))
    const bindings = parsed.bindings.map((binding) => ({
      ...binding,
      id: binding.source === "agent.currentOffer" ? "currentOffer" : binding.source.split(".")[1],
    }))
    return { ...parsed, bindings, html: sanitizeArtifactHtml(parsed.html) }
  } catch (error) {
    console.error("Gemini artifact generation failed", error)
    return fallbackArtifact(context)
  }
}

export function shouldGenerateArtifact(text: string, run: Record<string, unknown> | null) {
  void run
  const visual = /\b(dashboard|site|web\s?page|landing\s?page|live\s?view|visual(?:ization)?|chart|graph|report|brief|panel|sitio|p[aá]gina|vista|visualizaci[oó]n|gr[aá]fic[ao]|reporte|informe|tabla)\b/i
  const request = /\b(create|build|generate|render|design|show|make|prepare|visualize|convert|turn|crea|crear|construye|genera|generar|renderiza|diseña|diseñar|muestra|mostrar|visualiza|visualizar|convierte|convertir|prepara|preparar)\b/i
  return visual.test(text) && request.test(text)
}
