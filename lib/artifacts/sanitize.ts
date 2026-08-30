import sanitizeHtml from "sanitize-html"

const allowedTags = [
  "article", "aside", "section", "header", "footer", "main", "nav", "div", "span",
  "h1", "h2", "h3", "h4", "p", "small", "strong", "em", "ul", "ol", "li",
  "dl", "dt", "dd", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
  "figure", "figcaption", "svg", "g", "path", "line", "circle", "rect", "polyline",
  "style", "br", "hr",
]

const allowedAttributes: sanitizeHtml.IOptions["allowedAttributes"] = {
  "*": ["class", "id", "role", "aria-label", "aria-hidden", "data-tt-bind", "data-tt-format", "data-tt-chart", "data-tt-empty"],
  svg: ["viewBox", "width", "height", "fill", "stroke", "aria-label", "role"],
  g: ["fill", "stroke", "transform"],
  path: ["d", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin"],
  line: ["x1", "x2", "y1", "y2", "stroke", "stroke-width"],
  circle: ["cx", "cy", "r", "fill", "stroke"],
  rect: ["x", "y", "width", "height", "rx", "fill", "stroke"],
  polyline: ["points", "fill", "stroke", "stroke-width"],
  th: ["scope", "colspan", "rowspan"],
  td: ["colspan", "rowspan"],
}

export function sanitizeArtifactHtml(input: string) {
  return sanitizeHtml(input, {
    allowedTags,
    allowedAttributes,
    allowedSchemes: [],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    parseStyleAttributes: false,
    exclusiveFilter(frame) {
      return Object.keys(frame.attribs).some((name) => name.toLowerCase().startsWith("on"))
    },
    transformTags: {
      "*": (tagName, attribs) => {
        const safe: Record<string, string> = {}
        for (const [key, value] of Object.entries(attribs)) {
          if (!key.toLowerCase().startsWith("on") && !/javascript:|data:text\/html/i.test(value)) safe[key] = value
        }
        return { tagName, attribs: safe }
      },
    },
  })
}

