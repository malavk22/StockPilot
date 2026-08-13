-- Enforce unique warehouse names so the seed script can upsert by name
-- instead of forcing a hand-picked, non-UUID id.
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_name_key" UNIQUE ("name");
