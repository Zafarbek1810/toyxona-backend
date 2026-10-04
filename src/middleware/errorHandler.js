import { ZodError } from "zod";
import { ApiError } from "../utils/helpers.js";
import { env } from "../config/env.js";

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validatsiya xatosi",
      details: err.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details,
    });
  }

  if (err?.code === "P2002") {
    return res.status(409).json({
      success: false,
      message: "Bu ma'lumot allaqachon mavjud",
      details: err.meta,
    });
  }

  if (err?.code === "P2025") {
    return res.status(404).json({ success: false, message: "Yozuv topilmadi" });
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    message: env.isDev ? err.message || "Server xatosi" : "Server xatosi",
  });
}

export function notFound(_req, res) {
  res.status(404).json({ success: false, message: "Endpoint topilmadi" });
}
