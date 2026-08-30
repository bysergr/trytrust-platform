import { ZodError } from "zod"

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return Response.json({ error: "Invalid request", issues: error.issues }, { status: 400 })
  }
  const message = error instanceof Error ? error.message : "Unexpected error"
  const status = message === "UNAUTHORIZED" ? 401 : message === "PASSKEY_ENROLLMENT_REQUIRED" ? 403 : message === "NOT_FOUND" ? 404 : 500
  return Response.json({ error: message }, { status })
}

export async function parseJson(request: Request) {
  try {
    return await request.json()
  } catch {
    throw new Error("Invalid JSON body")
  }
}
