import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../config/db.js";
import {
  ApiError,
  asyncHandler,
  normalizePhone,
  isValidUzPhone,
  ok,
  paginate,
  paginationMeta,
} from "../utils/helpers.js";
import { serializeUser } from "../utils/serializers.js";

export const getMe = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { seller: true },
  });
  return ok(res, serializeUser(user));
});

export const updateMe = asyncHandler(async (req, res) => {
  const schema = z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    email: z.string().email().optional().nullable(),
    birthDate: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    phone: z.string().optional(),
  });
  const data = schema.parse(req.body);
  const update = { ...data };

  if (data.phone) {
    const phone = normalizePhone(data.phone);
    if (!isValidUzPhone(phone)) throw new ApiError(400, "Telefon noto'g'ri");
    update.phone = phone;
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: update,
    include: { seller: true },
  });
  return ok(res, serializeUser(user));
});

export const changePassword = asyncHandler(async (req, res) => {
  const schema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
  });
  const data = schema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
  if (!valid) throw new ApiError(400, "Joriy parol noto'g'ri");

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(data.newPassword, 10) },
  });
  return ok(res, { message: "Parol yangilandi" });
});

export const deleteMe = asyncHandler(async (req, res) => {
  await prisma.user.update({
    where: { id: req.user.id },
    data: { active: false },
  });
  return ok(res, { message: "Hisob o'chirildi" });
});

export const getSettings = asyncHandler(async (req, res) => {
  const u = req.user;
  return ok(res, {
    orderUpdates: u.orderUpdates,
    promoEmails: u.promoEmails,
    smsAlerts: u.smsAlerts,
    language: u.language,
    currency: u.currency,
  });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const schema = z.object({
    orderUpdates: z.boolean().optional(),
    promoEmails: z.boolean().optional(),
    smsAlerts: z.boolean().optional(),
    language: z.enum(["uz", "ru", "en"]).optional(),
    currency: z.enum(["uzs", "usd"]).optional(),
  });
  const data = schema.parse(req.body);
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data,
  });
  return ok(res, {
    orderUpdates: user.orderUpdates,
    promoEmails: user.promoEmails,
    smsAlerts: user.smsAlerts,
    language: user.language,
    currency: user.currency,
  });
});

export const adminListUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = { role: "customer" };
  if (req.query.q) {
    const q = String(req.query.q);
    where.OR = [
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { phone: { contains: q } },
      { email: { contains: q } },
    ];
  }
  if (req.query.status === "active") where.active = true;
  if (req.query.status === "blocked") where.active = false;

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        seller: true,
        _count: { select: { orders: true } },
      },
    }),
  ]);

  const data = await Promise.all(
    users.map(async (u) => {
      const spent = await prisma.order.aggregate({
        where: { customerId: u.id, status: { not: "cancelled" } },
        _sum: { total: true },
      });
      return {
        ...serializeUser(u),
        ordersCount: u._count.orders,
        totalSpent: spent._sum.total || 0,
      };
    }),
  );

  return ok(res, data, paginationMeta(total, page, limit));
});

export const adminUpdateUser = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const schema = z.object({
    active: z.boolean().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email().optional().nullable(),
    city: z.string().optional().nullable(),
  });
  const data = schema.parse(req.body);
  const user = await prisma.user.update({
    where: { id },
    data,
    include: { seller: true },
  });
  return ok(res, serializeUser(user));
});

export const adminDeleteUser = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) throw new ApiError(400, "O'zingizni o'chira olmaysiz");
  await prisma.user.delete({ where: { id } });
  return ok(res, { message: "Foydalanuvchi o'chirildi" });
});
