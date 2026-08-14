# StockPilot

Inventory & warehouse management platform built on the PERN stack (PostgreSQL, Express, React, Node.js).

**Status:** In development.

## Why an append-only stock ledger

Current stock is never stored as a mutable counter. Every change to inventory — a restock, a sale, a manual correction — is recorded as a signed `StockMovement` row (`IN` / `OUT` / `ADJUSTMENT`). The current stock level for a product is always the sum of its movements.

This trades a small amount of query complexity for two guarantees a mutable counter can't give you:

1. **Correctness under concurrent writes.** Two simultaneous stock deductions can't silently clobber each other — both rows persist, and the total is always accurate.
2. **A free, complete audit trail.** "What happened to this product's stock, and when" is a query against history, not a separate logging system bolted on afterward.

Purchase order receiving builds directly on this: receiving an order doesn't set a stock number, it posts an `IN` movement per line — through the exact same ledger a manual restock uses — inside one transaction with the order's status flip, so it's either fully received or not received at all.

## Key features

- **Ledger-backed stock tracking** across multiple warehouses, with manual movements, warehouse-to-warehouse transfers, and low-stock alerts
- **Suppliers & purchase orders** — raise a draft order, submit it, and receive it into the ledger with an auditable trail from order to stock
- **Dashboard** — KPIs, trend charts, movements-by-type breakdown, recent activity feed, quick actions
- **Dedicated + scattered ledger views** — a global filterable Ledger page, plus per-product movement history
- **PDF inventory reports** — generated server-side (pdfkit) and downloadable on demand
- **Role-based access** (ADMIN / STAFF) with JWT auth

## Tech stack

- **Backend:** Node.js, Express, PostgreSQL, Prisma ORM, JWT auth, Zod validation, pdfkit (PDF report generation)
- **Frontend:** React (Vite), TypeScript, Recharts
- **Security:** bcrypt password hashing, Helmet security headers, rate-limited auth endpoints, environment-scoped CORS

## Project structure

```
backend/
  prisma/           # schema + migrations
  src/
    config/         # env, http/CORS config
    constants/
    errors/         # typed AppError + error codes
    middlewares/     # auth, validation, error handling
    routes/
    controllers/
    services/       # business logic
frontend/            # React frontend (Vite)
```

## Running locally

```bash
# Backend
cd backend
npm install
cp .env.example .env.local   # fill in DATABASE_URL and a real JWT_SECRET
npx prisma migrate deploy
npx prisma db seed           # creates one admin@stockpilot.dev account
npm run dev                  # http://localhost:5100

# Frontend
cd frontend
npm install
npm run dev                  # http://localhost:5173
```

Demo accounts (seeded): `admin@stockpilot.dev` (ADMIN), password `admin12345`. New sign-ups via the Register page always join as STAFF — there is no client-controlled path to ADMIN.

## Testing

```bash
cd backend
npx prisma migrate deploy --schema prisma/schema.prisma   # against a separate test DB, see .env.test.example
npm test
```

Unit tests cover the ledger's sign-conversion logic in isolation. Integration tests run against a real Postgres database (not mocked) and verify the behaviors that actually matter: the oversell guard correctly rejects an `OUT` movement that would push stock negative, `getLowStockProducts` correctly includes/excludes products relative to their threshold, and a purchase order can't be received before it's submitted, can't be received twice, and can't be cancelled once it's already received.
