-- Recheck once so existing stored headlines receive the current AI/Tech desk rules.
UPDATE feed_sync SET checked_at=NULL,next_at='1970-01-01T00:00:00.000Z',error=NULL WHERE id=1;
