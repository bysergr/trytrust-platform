export function publicBindingPayload(payload: Record<string, unknown>, allowlist: Record<string, string[]>) {
  const output: Record<string, unknown> = {}
  for (const [bindingId, fields] of Object.entries(allowlist)) {
    if (!fields.length) continue
    const value = payload[bindingId]
    if (Array.isArray(value)) output[bindingId] = value.map((row) => pick(row, fields))
    else if (value && typeof value === "object") output[bindingId] = pick(value, fields)
  }
  return output
}

function pick(value: unknown, fields: string[]) {
  if (!value || typeof value !== "object") return value
  const source = value as Record<string, unknown>, result: Record<string, unknown> = {}
  for (const field of fields) if (Object.hasOwn(source, field)) result[field] = source[field]
  return result
}
