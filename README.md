# StockPilot

Inventory & warehouse management platform built on the PERN stack (PostgreSQL, Express, React, Node.js).

**Status:** In development.

## Why an append-only stock ledger

Current stock is never stored as a mutable counter. Every change to inventory — a restock, a sale, a manual correction — is recorded as a signed `StockMovement` row (`IN` / `OUT` / `ADJUSTMENT`). The current stock level for a product is always the sum of its movements.

This trades a small amount of query complexity for two guarantees a mutable counter can't give you:

1. **Correctness under concurrent writes.** Two simultaneous stock deductions can't silently clobber each other — both rows persist, and the total is always accurate.
2. **A free, complete audit trail.** "What happened to this product's stock, and when" is a query against history, not a separate logging system bolted on afterward.

## Tech stack

- **Backend:** Node.js, Express, PostgreSQL, Prisma ORM, JWT auth, Zod validation
- **Frontend:** React (Vite), TypeScript
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
