import { prisma } from "../config/db.js";
import { ApiError, asyncHandler, ok, created } from "../utils/helpers.js";
import { serializeProduct } from "../utils/serializers.js";

export const listFavorites = asyncHandler(async (req, res) => {
  const items = await prisma.favorite.findMany({
    where: { userId: req.user.id },
    include: { product: { include: { seller: true, category: true } } },
    orderBy: { createdAt: "desc" },
  });
  return ok(res, items.map((f) => ({
    id: f.id,
    productId: f.productId,
    product: serializeProduct(f.product),
    createdAt: f.createdAt,
  })));
});

export const addFavorite = asyncHandler(async (req, res) => {
  const productId = Number(req.params.productId);
  const product = await prisma.product.findFirst({
    where: { id: productId, status: "active", moderationStatus: "approved" },
  });
  if (!product) throw new ApiError(404, "Mahsulot topilmadi");

  const fav = await prisma.favorite.upsert({
    where: { userId_productId: { userId: req.user.id, productId } },
    create: { userId: req.user.id, productId },
    update: {},
    include: { product: { include: { seller: true, category: true } } },
  });

  return created(res, {
    id: fav.id,
    productId: fav.productId,
    product: serializeProduct(fav.product),
  });
});

export const removeFavorite = asyncHandler(async (req, res) => {
  const productId = Number(req.params.productId);
  const fav = await prisma.favorite.findUnique({
    where: { userId_productId: { userId: req.user.id, productId } },
  });
  if (!fav) throw new ApiError(404, "Sevimlilarda topilmadi");
  await prisma.favorite.delete({ where: { id: fav.id } });
  return ok(res, { message: "Sevimlilardan olib tashlandi" });
});

export const toggleFavorite = asyncHandler(async (req, res) => {
  const productId = Number(req.params.productId);
  const existing = await prisma.favorite.findUnique({
    where: { userId_productId: { userId: req.user.id, productId } },
  });
  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return ok(res, { favorited: false, productId });
  }
  await prisma.favorite.create({ data: { userId: req.user.id, productId } });
  return ok(res, { favorited: true, productId });
});
