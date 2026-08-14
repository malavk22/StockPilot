-- Replaces the client-picked poNumber string (race-prone under concurrent
-- creates) with a DB-generated autoincrement sequence. The human-readable
-- "PO-00001" label is formatted from this at read time.
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT IF EXISTS "PurchaseOrder_poNumber_key";
DROP INDEX IF EXISTS "PurchaseOrder_poNumber_key";

CREATE SEQUENCE IF NOT EXISTS "PurchaseOrder_sequenceNumber_seq";

ALTER TABLE "PurchaseOrder"
  DROP COLUMN IF EXISTS "poNumber",
  ADD COLUMN "sequenceNumber" INTEGER NOT NULL DEFAULT nextval('"PurchaseOrder_sequenceNumber_seq"');

ALTER SEQUENCE "PurchaseOrder_sequenceNumber_seq" OWNED BY "PurchaseOrder"."sequenceNumber";

CREATE UNIQUE INDEX "PurchaseOrder_sequenceNumber_key" ON "PurchaseOrder"("sequenceNumber");
