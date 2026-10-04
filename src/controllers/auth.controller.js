import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../config/db.js";
import { signToken } from "../middleware/auth.js";
import {
  ApiError,
  asyncHandler,
  created,
  normalizePhone,
  isValidUzPhone,
  ok,
  slugify,
} from "../utils/helpers.js";
import { serializeUser } from "../utils/serializers.js";

const loginSchema = z.object({
  phone: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string().min(1),
}).refine((d) => d.phone || d.email, { message: "Telefon yoki email kerak" });

const registerSchema = z.object({
  phone: z.string().min(9),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  role: z.enum(["customer", "seller"]).default("customer"),
  storeName: z.string().optional(),
  businessType: z.enum(["individual", "yatt", "mchj", "aj"]).optional(),
  city: z.string().optional(),
  description: z.string().optional(),
});

export const register = asyncHandler(async (req, res) => {
  const data = registerSchema.parse(req.body);
  const phone = normalizePhone(data.phone);
  if (!isValidUzPhone(phone)) throw new ApiError(400, "Telefon raqam noto'g'ri (9 raqam)");

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) throw new ApiError(409, "Bu telefon raqam allaqachon ro'yxatdan o'tgan");

  if (data.role === "seller" && !data.storeName?.trim()) {
    throw new ApiError(400, "Do'kon nomi majburiy");
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        phone,
        email: data.email || null,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        city: data.city || null,
      },
    });

    if (data.role === "seller") {
      let slug = slugify(data.storeName);
      const slugExists = await tx.seller.findUnique({ where: { slug } });
      if (slugExists) slug = `${slug}-${Date.now().toString(36)}`;

      const expires = new Date();
      expires.setMonth(expires.getMonth() + 1);

      await tx.seller.create({
        data: {
          userId: createdUser.id,
          name: data.storeName,
          slug,
          description: data.description || null,
          location: data.city || null,
          phone,
          email: data.email || null,
          businessType: data.businessType || "individual",
          status: "pending",
          planId: "start",
          planExpiresAt: expires,
        },
      });
    }

    return tx.user.findUnique({
      where: { id: createdUser.id },
      include: { seller: true },
    });
  });

  const token = signToken(user);
  return created(res, { token, user: serializeUser(user) });
});

export const login = asyncHandler(async (req, res) => {
  const data = loginSchema.parse(req.body);
  let user = null;

  if (data.phone) {
    const phone = normalizePhone(data.phone);
    user = await prisma.user.findUnique({ where: { phone }, include: { seller: true } });
  } else if (data.email) {
    user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { seller: true },
    });
  }

  if (!user) throw new ApiError(401, "Telefon/email yoki parol noto'g'ri");
  if (!user.active) throw new ApiError(403, "Hisobingiz bloklangan");

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) throw new ApiError(401, "Telefon/email yoki parol noto'g'ri");

  const token = signToken(user);
  return ok(res, { token, user: serializeUser(user) });
});

export const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { seller: true },
  });
  return ok(res, serializeUser(user));
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const phone = normalizePhone(req.body.phone || "");
  if (!isValidUzPhone(phone)) throw new ApiError(400, "Telefon raqam noto'g'ri");

  const user = await prisma.user.findUnique({ where: { phone } });
  // Always succeed to avoid user enumeration
  if (!user) {
    return ok(res, { message: "Agar raqam mavjud bo'lsa, SMS kod yuborildi", demoCode: null });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.passwordReset.create({
    data: { userId: user.id, code, expiresAt },
  });

  // Dev: return code in response (SMS gateway stub)
  return ok(res, {
    message: "SMS kod yuborildi",
    demoCode: process.env.NODE_ENV === "production" ? undefined : code,
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const schema = z.object({
    phone: z.string().min(9),
    code: z.string().min(4),
    password: z.string().min(8),
  });
  const data = schema.parse(req.body);
  const phone = normalizePhone(data.phone);

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) throw new ApiError(400, "Kod yaroqsiz");

  const reset = await prisma.passwordReset.findFirst({
    where: {
      userId: user.id,
      code: data.code,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!reset) throw new ApiError(400, "Kod yaroqsiz yoki muddati tugagan");

  const passwordHash = await bcrypt.hash(data.password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    prisma.passwordReset.update({ where: { id: reset.id }, data: { used: true } }),
  ]);

  return ok(res, { message: "Parol muvaffaqiyatli yangilandi" });
});

export const logout = asyncHandler(async (_req, res) => {
  return ok(res, { message: "Chiqildi" });
});
