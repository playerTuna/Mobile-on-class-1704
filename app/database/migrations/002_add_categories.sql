CREATE TABLE IF NOT EXISTS "categories" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id" UUID NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "color" VARCHAR(20),
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "tasks"
ADD COLUMN IF NOT EXISTS "category_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "categories_user_id_name_key"
ON "categories"("user_id", "name");

CREATE INDEX IF NOT EXISTS "tasks_category_id_idx"
ON "tasks"("category_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_user_id_fkey'
  ) THEN
    ALTER TABLE "categories"
      ADD CONSTRAINT "categories_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_category_id_fkey'
  ) THEN
    ALTER TABLE "tasks"
      ADD CONSTRAINT "tasks_category_id_fkey"
      FOREIGN KEY ("category_id") REFERENCES "categories"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
