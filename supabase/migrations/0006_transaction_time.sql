-- Local time-of-day a transaction happened, "HH:MM" 24-hour -- kept
-- separate from `date` (YYYY-MM-DD) so existing date-string comparisons
-- throughout the intelligence layer are unaffected.
alter table transactions add column if not exists time text;
