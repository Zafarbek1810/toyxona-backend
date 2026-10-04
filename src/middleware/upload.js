import multer from "multer";
import path from "path";
import fs from "fs";
import { env } from "../config/env.js";
import { ApiError } from "../utils/helpers.js";

const uploadRoot = path.resolve(process.cwd(), env.uploadDir);
if (!fs.existsSync(uploadRoot)) fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const ok = /jpeg|jpg|png|webp|svg/i.test(path.extname(file.originalname)) ||
    /image\/(jpeg|jpg|png|webp|svg\+xml)/i.test(file.mimetype);
  if (!ok) return cb(new ApiError(400, "Faqat JPG, PNG, WEBP, SVG ruxsat etiladi"));
  cb(null, true);
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
});

export function publicUrl(filename) {
  if (!filename) return null;
  if (String(filename).startsWith("http")) return filename;
  return `/uploads/${path.basename(filename)}`;
}
