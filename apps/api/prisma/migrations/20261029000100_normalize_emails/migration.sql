BEGIN;

-- Never merge accounts that differ only in email casing or surrounding spaces.
DO $$
BEGIN
  IF EXISTS (
    SELECT lower(btrim("email")) FROM "User"
    GROUP BY lower(btrim("email")) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Email normalization found duplicate accounts. Resolve case-insensitive duplicate emails before retrying this migration.';
  END IF;
END $$;

UPDATE "User" SET "email" = lower(btrim("email"));
UPDATE "Order" SET "customerEmail" = lower(btrim("customerEmail")) WHERE "customerEmail" IS NOT NULL;

COMMIT;
