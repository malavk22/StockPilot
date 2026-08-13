// server/src/server.ts

import { env } from "./config/env.config.js";
import app from "./app.js";

app.listen(env.PORT, () => {
  console.log(`✅ StockPilot API running on port ${env.PORT}`);
  console.log(`📊 Database: Configured`);
});
