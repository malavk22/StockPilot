// backend/tests/setup.ts
//
// Loads .env.test before any test file runs, so the Prisma client (and
// env.config.ts's validation) point at the dedicated test database instead
// of dev or production.

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });
