import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

const globalForDb = globalThis as unknown as { tryTrustPool?: Pool }

export const hasDatabase = Boolean(process.env.DATABASE_URL)

const pool = process.env.DATABASE_URL
  ? globalForDb.tryTrustPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 })
  : null

if (process.env.NODE_ENV !== "production" && pool) globalForDb.tryTrustPool = pool

export const db = pool ? drizzle(pool, { schema }) : null

