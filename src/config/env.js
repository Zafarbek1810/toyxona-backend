import "dotenv/config";

export const env = {
  port: Number(process.env.PORT || 5050),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "postgresql://fourcade7@localhost:5432/toyxona?schema=public",
  jwtSecret: process.env.JWT_SECRET || "toyxona-dev-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:8443,http://127.0.0.1:8443,http://localhost:5174,http://127.0.0.1:5174",
  uploadDir: process.env.UPLOAD_DIR || "uploads",
  isDev: (process.env.NODE_ENV || "development") !== "production",
};
