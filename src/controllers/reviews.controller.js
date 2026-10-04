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
import { serializeReview } from "../utils/serializers.js";

async function refreshProductRating(productId) {
  const agg = await prisma.review.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: true,
  });
  await prisma.product.update({
    where: { id: productId },
    data: {
      rating: Math.round((agg._avg.rating || 0) * 10) / 10,
      reviewCount: agg._count,
    },
  });
}

export const listProductReviews = asyncHandler(async (req, res) => {
  const productId = Number(req.params.id);
  const { page, limit, skip } = paginate(req.query);

  const [total, reviews] = await Promise.all([
    prisma.review.count({ where: { productId } }),
    prisma.review.findMany({
      where: { productId },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { user: true, product: true },
    }),
  ]);

  const histogram = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const all = await prisma.review.findMany({
    where: { productId },
    select: { rating: true },
  });
  for (const r of all) histogram[r.rating] = (histogram[r.rating] || 0) + 1;

  return ok(
    res,
    {
      reviews: reviews.map(serializeReview),
      histogram,
      average: all.length
        ? Math.round((all.reduce((s, r) => s + r.rating, 0) / all.length) * 10) / 10
        : 0,
      count: all.length,
    },
    paginationMeta(total, page, limit),
  );
});

export const createOrderReview = asyncHandler(async (req, res) => {
  const orderId = Number(req.params.id);
  const schema = z.object({
    rating: z.coerce.number().int().min(1).max(5),
    comment: z.string().min(3).max(2000),
    productId: z.coerce.number().int().positive().optional(),
  });
  const data = schema.parse(req.body);

  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId: req.user.id },
    include: { items: true },
  });
  if (!order) throw new ApiError(404, "Buyurtma topilmadi");
  if (order.status !== "delivered") {
    throw new ApiError(400, "Faqat yetkazilgan buyurtmaga sharh qoldirish mumkin");
  }
  if (order.reviewed) throw new ApiError(400, "Bu buyurtma allaqachon baholangan");

  const productId = data.productId || order.items[0]?.productId;
  if (!productId) throw new ApiError(400, "Mahsulot topilmadi");

  const review = await prisma.$transaction(async (tx) => {
    const createdReview = await tx.review.create({
      data: {
        productId,
        sellerId: order.sellerId,
        userId: req.user.id,
        orderId: order.id,
        rating: data.rating,
        comment: data.comment,
        verifiedPurchase: true,
      },
      include: { user: true, product: true },
    });
    await tx.order.update({ where: { id: order.id }, data: { reviewed: true } });
    return createdReview;
  });

  await refreshProductRating(productId);
  return created(res, serializeReview(review));
});

export const sellerListReviews = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = { sellerId: req.user.seller.id };
  if (req.query.replied === "true") where.sellerReply = { not: null };
  if (req.query.replied === "false") where.sellerReply = null;

  const [total, reviews] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { user: true, product: true },
    }),
  ]);
  return ok(res, reviews.map(serializeReview), paginationMeta(total, page, limit));
});

export const sellerReplyReview = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const schema = z.object({ reply: z.string().min(1).max(2000) });
  const { reply } = schema.parse(req.body);

  const existing = await prisma.review.findFirst({
    where: { id, sellerId: req.user.seller.id },
  });
  if (!existing) throw new ApiError(404, "Sharh topilmadi");

  const review = await prisma.review.update({
    where: { id },
    data: { sellerReply: reply, repliedAt: new Date() },
    include: { user: true, product: true },
  });
  return ok(res, serializeReview(review));
});
