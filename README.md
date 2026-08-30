# TryTrust Platform

TryTrust is a mobile-first Next.js 16 workspace for permissioned commerce agents. It combines a conversational agent, transaction analytics, generated live sites, Hanko authentication, and a server-only BFF over the existing TryTrust kernel.

## Local setup

1. Copy `.env.example` to `.env.local` and fill in the service credentials.
2. Apply `db/migrations/0001_trytrust_web.sql` to the PostgreSQL database.
3. Start the TryTrust kernel on port `8001` and the merchant service on port `8003`.
4. Run `pnpm dev` and open `http://localhost:3000`.

Without Hanko, PostgreSQL, Gemini, or the kernel configured, development mode uses isolated in-memory/demo adapters. Production fails closed for authentication, persistence, and kernel access.

## Hanko authentication policy

TryTrust exposes exactly two authentication actions:

- **Create account with Google** for first-time registration.
- **Sign in with Touch ID / passkey** for returning users.

After Google creates a session, the workspace remains locked until the user registers an account passkey on `/security`. The generic Hanko auth and profile elements are intentionally not mounted, so the application never presents email/password, email passcode, or password-management controls.

The same policy must also be enforced in the Hanko project configuration, because hiding a method in the UI does not disable its API:

1. Enable the Google social connection and configure its OAuth client.
2. Disable password authentication and email passcode authentication.
3. Keep WebAuthn/passkeys enabled.
4. Add the application login URLs to the allowed redirect URLs, including `http://localhost:3000/login` for local development and `https://trytrust.lat/login` for production.

Existing non-Google test accounts should be removed from the Hanko project before production if the project previously allowed email registration.

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
