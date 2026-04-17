-- Create categories table
CREATE TABLE "categories" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- Add category relation to tasks
ALTER TABLE "tasks"
ADD COLUMN "category_id" TEXT;

-- Add constraints and indexes
CREATE UNIQUE INDEX "categories_user_id_name_key" ON "categories"("user_id", "name");
CREATE INDEX "tasks_category_id_idx" ON "tasks"("category_id");

ALTER TABLE "categories"
ADD CONSTRAINT "categories_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "tasks"
ADD CONSTRAINT "tasks_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "categories"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
