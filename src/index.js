import env from "./config/env.js";
import { createApp } from "./app.js";
import { prisma } from "./lib/prisma.js";

async function main() {
  try {
    await prisma.$connect();
    console.log("[db] database connected");
  } catch (err) {
    console.error("[db] failed to connect:", err);
    process.exit(1);
  }

  const app = createApp();

  app.listen(env.port, () => {
    console.log(`[server] DevForge API running on http://localhost:${env.port}`);
    console.log(`[server] environment=${env.nodeEnv} demoMode=${env.demoMode}`);
  });
}

main().catch((err) => {
  console.error("[server] fatal error:", err);
  process.exit(1);
});