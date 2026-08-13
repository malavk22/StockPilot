-- Adds TRANSFER_IN/TRANSFER_OUT so a warehouse-to-warehouse transfer can be
-- recorded distinctly from a regular restock/sale in the ledger and audit trail.
ALTER TYPE "MovementType" ADD VALUE 'TRANSFER_IN';
ALTER TYPE "MovementType" ADD VALUE 'TRANSFER_OUT';
