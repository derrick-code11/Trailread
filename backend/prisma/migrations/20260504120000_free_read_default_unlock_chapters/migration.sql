-- Prefer open navigation; guided locks removed from product logic.
ALTER TABLE "user_books" ALTER COLUMN "mode" SET DEFAULT 'FREE_READ';

UPDATE "user_books" SET "mode" = 'FREE_READ';

UPDATE "user_chapter_progress" SET "status" = 'UNLOCKED' WHERE "status" = 'LOCKED';
