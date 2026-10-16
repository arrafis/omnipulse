# OmniPulse — portfolio case study

## Problem and product

Readers following AI, technology and markets must check multiple sites and distinguish company announcements from publisher reporting. OmniPulse brings those feeds into a single reading desk with topic filters, search, saved stories, and direct source links.

**Live demo:** https://omnipulse.sifath75.chatgpt.site

**Project owner:** Sifath Ar-Rafi. Developed with AI coding assistance. This case study describes implemented behavior; it does not claim user adoption, business revenue, or measured engagement improvements.

## Delivered experience

The public edition displays recent RSS/Atom headlines and short publisher excerpts across three desks. Readers can search titles and summaries, open original reports, save up to 100 stories locally, and return to their reading list without an account. The sources page explains ingestion, freshness and editorial limits.

## Engineering decisions

- **Store a durable cache:** D1 retains items during source outages. Each feed runs independently, so one failure does not discard successful updates from other sources.
- **Control repeated fetches:** An atomic database claim throttles refreshes across concurrent visits. A failed complete refresh becomes eligible sooner.
- **Validate publisher data:** Story links require HTTPS and an approved source host. Invalid dates, implausible future dates and stale entries are excluded; excerpts and input size are bounded.
- **Keep reader data local:** Reading-list snapshots are validated before rendering. This avoids introducing accounts for a simple reading task, with an explicit tradeoff of no cross-device sync.
- **Expose actual readiness:** Feed status distinguishes fresh, partial and stale updates. Newsletter and checkout stay disabled until their dependencies are configured.
- **Separate automation from public access:** The owner-only MCP interface supports background refresh without giving anonymous visitors privileged tools.

## Subscription design

The free digest uses confirmed email opt-in, signed unsubscribe links and provider idempotency. The planned $7 CAD/month Focus edition adds topic selection. Stripe checkout verifies the configured currency, amount and monthly interval; signed webhooks determine subscription entitlements. These integrations are implemented but not live until provider configuration and end-to-end tests are complete.

## Validation and limits

Core checks cover unsafe feed URLs, Atom link selection, malformed entities, date bounds, excerpt limits, and reading-list corruption, deduplication and capacity. Application types and the production Worker build are checked separately. Browser QA and live email/payment tests are separate launch requirements.

There are no fabricated usage or financial results. Useful metrics after launch would include feed success by source, stale-edition duration, confirmation conversion, delivery success, unsubscribe rate and paid retention.

## Demo walkthrough

1. Open the front page and inspect the feed refresh timestamp.
2. Switch between AI, Tech and Markets.
3. Search for a term present in the current edition.
4. Save a headline, open Saved, then return after a reload.
5. Open an original article and review About & sources.
6. Show the newsletter/premium section and explain the remaining launch dependencies honestly.
