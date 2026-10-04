import jwt from "jsonwebtoken";
import { prisma } from "../config/db.js";
import { env } from "../config/env.js";
import { ApiError, asyncHandler } from "../utils/helpers.js";

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, phone: user.phone },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new ApiError(401, "Autentifikatsiya talab qilinadi");

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new ApiError(401, "Token yaroqsiz yoki muddati tugagan");
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(payload.sub) },
    include: { seller: true },
  });

  if (!user || !user.active) throw new ApiError(401, "Foydalanuvchi topilmadi yoki bloklangan");

  req.user = user;
  next();
});

export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await prisma.user.findUnique({
      where: { id: Number(payload.sub) },
      include: { seller: true },
    });
    if (user?.active) req.user = user;
  } catch {
    /* ignore */
  }
  next();
});

export function requireRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new ApiError(401, "Autentifikatsiya talab qilinadi"));
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, "Bu amal uchun ruxsat yo'q"));
    }
    next();
  };
}

export function requireSeller(req, _res, next) {
  if (!req.user) return next(new ApiError(401, "Autentifikatsiya talab qilinadi"));
  if (req.user.role !== "seller" && req.user.role !== "admin") {
    return next(new ApiError(403, "Faqat sotuvchi uchun"));
  }
  if (req.user.role === "seller" && !req.user.seller) {
    return next(new ApiError(403, "Sotuvchi profili topilmadi"));
  }
  next();
}
