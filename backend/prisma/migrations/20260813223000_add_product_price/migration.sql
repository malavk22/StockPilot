-- Adds a unit price to products, enabling inventory value reporting
-- (total stock units alone doesn't tell you what's actually at stake).
ALTER TABLE "Product" ADD COLUMN "price" DECIMAL(10,2) NOT NULL DEFAULT 0;
