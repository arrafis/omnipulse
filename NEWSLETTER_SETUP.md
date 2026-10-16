# OmniPulse morning email launch

Production status (2026-10-15): sending-domain authentication and the provider delivery test passed; runtime credentials are stored in Sites. Free signups are enabled. Linked cloud tasks refresh news hourly and deliver the digest at 8:13 AM America/Toronto, with retries at 9:13–12:13 PM. The authenticated delivery function was verified with zero subscribers. The configuration guide below applies to a fresh deployment; do not enable the alternative GitHub scheduler alongside the linked Site task.

## Required production configuration

Set these in Sites runtime environment, never in Git:

| Key | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Email API key from Resend |
| `NEWSLETTER_FROM_EMAIL` | Verified domain sender, e.g. `OmniPulse <daily@news.example.com>` |
| `NEWSLETTER_SITE_URL` | Canonical HTTPS Site URL, without trailing slash |
| `NEWSLETTER_CONTACT_EMAIL` | Working contact address displayed in each message |
| `NEWSLETTER_POSTAL_ADDRESS` | Valid mailing address shown in confirmation and daily messages |
| `NEWSLETTER_SIGNING_KEY` | Random secret for unsubscribe links; preserve across deployments |
| `NEWSLETTER_JOB_TOKEN` | Random secret for the delivery endpoint; rotate if exposed |
| `NEWSLETTER_ENABLED` | Set to `true` only after the schedule and sender have been tested |

The sender must have a verified domain. Site access must allow intended readers to open confirmation and unsubscribe pages. Older launch-list addresses have no confirmation date and are excluded from daily delivery.

## Schedule contract

Use the owner's connected OmniPulse Site plugin for background work. Schedule `refresh_omnipulse_news` hourly and `deliver_omnipulse_morning_digest` at **8:13 AM America/Toronto**, with later morning retry runs. The Site tool handles a bounded batch of 25 and returns `remaining`; repeat calls until the batch is complete. Both calls use Site identity, no secret in the task prompt. Verify a tool call and read the D1 result before creating a schedule.

The GitHub workflow below remains an alternative if the user mirrors the source and manages a GitHub Actions secret. Do not run both schedulers for the same email job.

The included GitHub Actions workflow at `.github/workflows/morning-newsletter.yml` runs at **8:13 AM America/Toronto** and hourly through 12:13 PM for delayed delivery and retries. It uses `scripts/run-newsletter.mjs` to call `POST https://<site>/api/newsletter/deliver` with `Authorization: Bearer <NEWSLETTER_JOB_TOKEN>`, follow the `remaining` field, and report failed sends. GitHub can delay or occasionally drop scheduled workflow runs; the later morning runs and the per-day delivery log limit the effect.

To activate this workflow, mirror the Site source to a GitHub repository's default branch, set its Actions secret `NEWSLETTER_JOB_TOKEN` to the same value used in Sites, and set Actions variable `NEWSLETTER_ENABLED=true`. GitHub will not execute workflows held only in the Sites source repository. The Site must be accessible to the GitHub runner as well as readers; an owner-private Site will reject the scheduled request before it reaches the job endpoint.

Each invocation processes up to 25 confirmed free subscribers. The delivery log and Resend idempotency key guard against duplicate emails for the same local day. A failed individual send becomes eligible for retry after one hour. The endpoint fetches publisher feeds before choosing up to six recent stories; if there are none from the previous week, it sends no email.

## Launch checks

1. Verify the sender domain and contact details with the email provider.
2. Add the runtime secrets and connect the owner to the Site plugin for its scheduled tool. If using GitHub instead, mirror the source and set its Actions secret and variable. Keep `NEWSLETTER_ENABLED` unset during test calls.
3. Test a confirmation message and a single digest with an authorized test subscriber in a non-public environment.
4. Verify unsubscribe and failure retries. Make the Site accessible to intended subscribers.
5. Set `NEWSLETTER_ENABLED=true` and deploy the saved Site version to activate signups.

## Focus billing readiness

OmniPulse Focus is $7 CAD/month, with a morning digest chosen from the reader's AI, Tech, and Markets preferences. Configure a Stripe recurring Price of exactly CAD 7.00 per month, Stripe Tax, a customer portal, and a webhook for `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted` to `https://omnipulse.sifath75.chatgpt.site/api/premium/webhook`. Store `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET` as Sites secrets, then redeploy. The code verifies the price's currency, amount, and interval before checkout. `billingConfigured()` also requires the newsletter to be live, so nobody can pay before the Focus email can be delivered. Test checkout, an active entitlement, cancellation, and failed payment before enabling billing in production.

Until those settings exist, the price and product description are visible but no payment is accepted. Premium interest and topic selections are stored only after the reader opts into and confirms the daily email.
