# OmniPulse

**A source-linked reading desk for AI, technology and markets.**

[Live product](https://omnipulse.sifath75.chatgpt.site) · [Sources & methodology](https://omnipulse.sifath75.chatgpt.site/about) · [Portfolio case study](CASE_STUDY.md)

## What works today

- Public edition with AI, Tech and Markets filters, searchable titles and summaries, and shareable filter URLs.
- Publisher headlines and short excerpts, with direct links to original reports.
- Browser-local reading list for up to 100 saved stories, retained across visits.
- Further-reading cards selected from available publisher summaries.
- Responsive editorial layout, keyboard controls, reduced-motion styles, and visible feed freshness.
- Persistent feed cache with independent source failures, URL validation and refresh throttling.

The edition checks feeds at most once per Toronto date, at or after 8 AM Eastern Time. It shows up to 24 items per category from the previous seven days. Visits and newsletter runs can complete a delayed morning check but never start another same-day refresh. There is no automatic intraday page reload. Publisher excerpts are not generated analysis, and feed updates are not real-time market data.

## Launch status

| Feature | Status |
| --- | --- |
| Public news product | Live |
| Saved stories | Browser-local; no cross-device sync |
| Automatic updates while closed | Enabled hourly at :40, America/Toronto |
| Morning newsletter | Signups enabled; daily 8:13 AM America/Toronto, with hourly retries through 12:13 PM |
| Focus premium edition | $7 CAD/month implementation; email launch and Stripe configuration pending |
| Public GitHub repository | [arrafis/omnipulse](https://github.com/arrafis/omnipulse); deployment remains on Sites |

Email signup uses confirmed opt-in. The sender domain is verified and delivery configuration is active. The scheduled delivery tool was verified with an empty subscriber list; the provider test email was delivered. A live subscriber confirmation walkthrough is still recommended. Paid checkout remains disabled until Stripe configuration and payment tests are complete.

## Architecture

```mermaid
flowchart TD
  Reader[Reader] --> App[React and Vinext app]
  App --> Cache[Cloudflare D1]
  App --> Feeds[Publisher RSS and Atom feeds]
  Owner[Owner refresh tool] --> App
```

| Layer | Implementation |
| --- | --- |
| UI | React 19, TypeScript, CSS editorial layout |
| Server | Vinext, Cloudflare Workers |
| Storage | Cloudflare D1 with Drizzle migrations |
| Feed ingestion | Bounded RSS/Atom parsing, allowlisted HTTPS story hosts, 6.5-second fetch timeout |
| Reading list | Validated localStorage snapshots, maximum 100 items |
| Email | Resend integration, confirmed opt-in, signed preferences/unsubscribe links, delivery log |
| Billing | Stripe Checkout, verified webhook entitlements, customer portal |
| Background interface | Owner-authorized Site MCP tools |

## Run locally

Requires Node.js 22.13 or later and pnpm matching `packageManager` in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
```

The build creates `dist/server/wrangler.json`. Before running against a new local database, apply each SQL file under `drizzle/` in numeric order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_new_gamma_corps.sql
```

Repeat with the remaining migration filenames. Do not replay migrations already applied. Then run `pnpm dev`. Local state and credentials are ignored by Git. Local feed fetches require internet access.

## Background updates

The Site exposes `refresh_omnipulse_news` and `deliver_omnipulse_morning_digest` through its owner plugin. Calls enforce the original owner's authenticated identity; public discovery does not grant write access.

The owner OmniPulse connection and both schedules are active. Refresh authorization and D1 readback were verified. Digest delivery processes at most 25 confirmed subscribers per call; repeat while `remaining` is true. Idempotency and delivery records prevent repeat delivery for the same Toronto date. Never put secrets in automation prompts.

See [NEWSLETTER_SETUP.md](NEWSLETTER_SETUP.md) for required runtime settings, sender verification, billing, and launch checks.

## Verification

`pnpm test` covers RSS/Atom parsing, unsafe hosts and URLs, invalid dates/entities, bounded excerpts, and corrupt/unsafe/duplicate reading-list records. It also checks server-rendered category/search states and the MCP protocol/authentication boundary with stubbed services. `pnpm typecheck` checks application types. `pnpm build` creates the Worker artifact. The newsletter test runs real SQL in a temporary SQLite database and captures all email requests locally. It covers confirmed opt-in, throttling, one-use confirmation links, reply-to, per-day delivery deduplication and unsubscribe. Browser interaction QA must be recorded separately; these checks alone do not prove hydration or visual behavior.

## Constraints

Source availability and feed publication cadence vary. Headlines belong to their publishers. Saved stories are device-specific. Email, payments and unattended schedules require service configuration. The project does not promise investment advice, factual verification of publisher reporting, or profitable trading signals.
