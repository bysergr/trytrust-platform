import { index, integer, jsonb, pgSchema, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import type { DataBinding } from "@/lib/types"

export const web = pgSchema("trytrust_web")

export const users = web.table("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const agentSessions = web.table("agent_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  backendSessionId: text("backend_session_id").notNull(),
  agentId: text("agent_id").notNull(),
  mandateJti: text("mandate_jti").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("agent_sessions_backend_owner_uq").on(table.ownerId, table.backendSessionId)])

export const sites = web.table("sites", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  slug: text("slug").notNull(),
  status: text("status", { enum: ["draft", "published", "archived"] }).notNull().default("draft"),
  currentVersionId: uuid("current_version_id"),
  publicConfig: jsonb("public_config").$type<{ bindingAllowlist: Record<string, string[]> }>().notNull().default({ bindingAllowlist: {} }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [uniqueIndex("sites_slug_uq").on(table.slug), index("sites_owner_idx").on(table.ownerId)])

export const siteVersions = web.table("site_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  html: text("html").notNull(),
  bindings: jsonb("bindings").$type<DataBinding[]>().notNull().default([]),
  sourceContext: jsonb("source_context").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("site_versions_number_uq").on(table.siteId, table.version)])

