-- Retire untouched prototype copy. Owner-edited articles remain published.
UPDATE articles
SET status='draft', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE slug IN (
  'why-structured-ai-outputs-need-a-second-check',
  'what-directstorage-changes-for-game-loading',
  'why-fixed-rate-bond-prices-move-opposite-rates'
)
AND status='published'
AND updated_at=created_at;
