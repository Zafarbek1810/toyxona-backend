import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/db.js";

const app = createApp();

async function main() {
  await prisma.$connect();
  app.listen(env.port, () => {
    console.log(`\n🚀 To'yxona API: http://localhost:${env.port}/api`);
    console.log(`   Health:       http://localhost:${env.port}/api/health`);
    console.log(`   Env:          ${env.nodeEnv}\n`);
  });
}

main().catch((err) => {
  console.error("Server ishga tushmadi:", err);
  process.exit(1);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
