# TryTrust Platform

TryTrust is a mobile-first Next.js 16 workspace for permissioned commerce agents. It combines a conversational agent, transaction analytics, generated live sites, Hanko authentication, and a server-only BFF over the existing TryTrust kernel.

## Local setup

1. Copy `.env.example` to `.env.local` and fill in the service credentials.
2. Apply `db/migrations/0001_trytrust_web.sql` to the PostgreSQL database.
3. Start the TryTrust kernel on port `8001` and the merchant service on port `8003`.
4. Run `pnpm dev` and open `http://localhost:3000`.

Without Hanko, PostgreSQL, Gemini, or the kernel configured, development mode uses isolated in-memory/demo adapters. Production fails closed for authentication, persistence, and kernel access.

## Architecture

- The browser calls only private Next.js Route Handlers.
- Hanko validates the account session; Hanko passkeys and mandate-signing WebAuthn credentials are separate.
- The BFF resolves the active mandate and never trusts a client-provided mandate JTI.
- The backend owns Gemini agent execution and the commercial MCP at `/mcp`.
- Presentation-only Gemini output is schema-validated, sanitized, and rendered in a sandboxed iframe.
- Public sites expose only the binding fields selected at publish time.
- Analytics never combines monetary totals from different currencies.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The shadcn components use the existing `base-luma` preset and the application tokens in `app/globals.css`.
