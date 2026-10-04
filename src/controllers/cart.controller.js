import { z } from "zod";
import { prisma } from "../config/db.js";
import { ApiError, asyncHandler, ok, created } from "../utils/helpers.js";
import { serializeProduct } from "../utils/serializers.js";

export const getCart = asyncHandler(async (req, res) => {
  const items = await prisma.cartItem.findMany({
    where: { userId: req.user.id },
    include: { product: { include: { seller: true, category: true } } },
    orderBy: { createdAt: "desc" },
  });

  const data = items.map((i) => ({
    id: i.id,
    productId: i.productId,
    quantity: i.quantity,
    product: serializeProduct(i.product),
    lineTotal: i.product.price * i.quantity,
  }));

  const subtotal = data.reduce((s, i) => s + i.lineTotal, 0);
  return ok(res, { items: data, subtotal, count: data.length });
});

export const addToCart = asyncHandler(async (req, res) => {
  const schema = z.object({
    productId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().min(1).default(1),
  });
  const { productId, quantity } = schema.parse(req.body);

  const product = await prisma.product.findFirst({
    where: { id: productId, status: "active", moderationStatus: "approved" },
  });
  if (!product) throw new ApiError(404, "Mahsulot topilmadi");
  if (product.stock < quantity) throw new ApiError(400, "Omborda yetarli mahsulot yo'q");

  const item = await prisma.cartItem.upsert({
    where: { userId_productId: { userId: req.user.id, productId } },
    create: { userId: req.user.id, productId, quantity },
    update: { quantity: { increment: quantity } },
    include: { product: { include: { seller: true, category: true } } },
  });

  return created(res, {
    id: item.id,
    productId: item.productId,
    quantity: item.quantity,
    product: serializeProduct(item.product),
  });
});

export const updateCartItem = asyncHandler(async (req, res) => {
  const productId = Number(req.params.productId);
  const schema = z.object({ quantity: z.coerce.number().int().min(1) });
  const { quantity } = schema.parse(req.body);

  const item = await prisma.cartItem.findUnique({
    where: { userId_productId: { userId: req.user.id, productId } },
  });
  if (!item) throw new ApiError(404, "Savatda topilmadi");

  const updated = await prisma.cartItem.update({
    where: { id: item.id },
    data: { quantity },
    include: { product: { include: { seller: true, category: true } } },
  });

  return ok(res, {
    id: updated.id,
    productId: updated.productId,
    quantity: updated.quantity,
    product: serializeProduct(updated.product),
  });
});

export const removeCartItem = asyncHandler(async (req, res) => {
  const productId = Number(req.params.productId);
  const item = await prisma.cartItem.findUnique({
    where: { userId_productId: { userId: req.user.id, productId } },
  });
  if (!item) throw new ApiError(404, "Savatda topilmadi");
  await prisma.cartItem.delete({ where: { id: item.id } });
  return ok(res, { message: "Savatdan olib tashlandi" });
});

export const applyPromo = asyncHandler(async (req, res) => {
  const code = String(req.body.code || "").trim().toUpperCase();
  if (!code) throw new ApiError(400, "Promo kod kerak");

  const promo = await prisma.promotion.findFirst({
    where: {
      promoCode: code,
      status: "active",
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
    },
  });
  if (!promo) throw new ApiError(404, "Promo kod topilmadi yoki muddati tugagan");

  await prisma.promotion.update({
    where: { id: promo.id },
    data: { clicks: { increment: 1 } },
  });

  return ok(res, {
    code: promo.promoCode,
    discountPct: promo.discountPct || 0,
    title: promo.title,
  });
});
