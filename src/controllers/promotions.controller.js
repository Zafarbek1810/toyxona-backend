import { z } from "zod";
import { prisma } from "../config/db.js";
import {
  ApiError,
  asyncHandler,
  created,
  ok,
  paginate,
  paginationMeta,
} from "../utils/helpers.js";
import { serializePromotion, serializeNotification } from "../utils/serializers.js";

export const listActivePromotions = asyncHandler(async (_req, res) => {
  const now = new Date();
  const items = await prisma.promotion.findMany({
    where: {
      status: "active",
      startDate: { lte: now },
      endDate: { gte: now },
    },
    orderBy: { createdAt: "desc" },
  });
  return ok(res, items.map(serializePromotion));
});

export const adminListPromotions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = {};
  if (req.query.status) where.status = req.query.status;

  const [total, items] = await Promise.all([
    prisma.promotion.count({ where }),
    prisma.promotion.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return ok(res, items.map(serializePromotion), paginationMeta(total, page, limit));
});

export const adminCreatePromotion = asyncHandler(async (req, res) => {
  const schema = z.object({
    title: z.string().min(1),
    type: z.enum(["banner", "popup", "email", "flash"]).default("banner"),
    status: z.enum(["active", "scheduled", "ended"]).default("scheduled"),
    description: z.string().optional().nullable(),
    link: z.string().optional().nullable(),
    image: z.string().optional().nullable(),
    promoCode: z.string().optional().nullable(),
    discountPct: z.coerce.number().int().min(0).max(100).optional().nullable(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  });
  const data = schema.parse(req.body);
  if (data.promoCode) data.promoCode = data.promoCode.toUpperCase();

  const promo = await prisma.promotion.create({ data });
  return created(res, serializePromotion(promo));
});

export const adminUpdatePromotion = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const schema = z.object({
    title: z.string().min(1).optional(),
    type: z.enum(["banner", "popup", "email", "flash"]).optional(),
    status: z.enum(["active", "scheduled", "ended"]).optional(),
    description: z.string().optional().nullable(),
    link: z.string().optional().nullable(),
    image: z.string().optional().nullable(),
    promoCode: z.string().optional().nullable(),
    discountPct: z.coerce.number().int().min(0).max(100).optional().nullable(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  });
  const data = schema.parse(req.body);
  if (data.promoCode) data.promoCode = data.promoCode.toUpperCase();

  const promo = await prisma.promotion.update({ where: { id }, data });
  return ok(res, serializePromotion(promo));
});

export const adminDeletePromotion = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await prisma.promotion.delete({ where: { id } });
  return ok(res, { message: "Aksiya o'chirildi" });
});

export const listNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = { userId: req.user.id };
  if (req.query.unread === "true") where.read = false;

  const [total, items, unread] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.notification.count({ where: { userId: req.user.id, read: false } }),
  ]);

  return ok(
    res,
    { items: items.map(serializeNotification), unread },
    paginationMeta(total, page, limit),
  );
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.notification.findFirst({
    where: { id, userId: req.user.id },
  });
  if (!existing) throw new ApiError(404, "Bildirishnoma topilmadi");

  const n = await prisma.notification.update({
    where: { id },
    data: { read: true },
  });
  return ok(res, serializeNotification(n));
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user.id, read: false },
    data: { read: true },
  });
  return ok(res, { message: "Barchasi o'qilgan deb belgilandi" });
});

export const deleteNotification = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.notification.findFirst({
    where: { id, userId: req.user.id },
  });
  if (!existing) throw new ApiError(404, "Bildirishnoma topilmadi");
  await prisma.notification.delete({ where: { id } });
  return ok(res, { message: "O'chirildi" });
});
