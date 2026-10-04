import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";
import { env } from "./config/env.js";
import api from "./routes/index.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: env.corsOrigin === "*" ? true : env.corsOrigin.split(",").map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(morgan(env.isDev ? "dev" : "combined"));
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use(
    "/api",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 1000,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use("/uploads", express.static(path.resolve(process.cwd(), env.uploadDir)));
  app.use("/api", api);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
