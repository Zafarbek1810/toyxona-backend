import { z } from "zod";
import { prisma } from "../config/db.js";
import {
  ApiError,
  asyncHandler,
  created,
  ok,
  paginate,
  paginationMeta,
  parseJson,
  toJson,
} from "../utils/helpers.js";
import { serializeCategory, serializeProduct, serializeSubcategory } from "../utils/serializers.js";

const boolFromBody = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return value;
}, z.boolean().optional());

function withUploadedIcon(data, file) {
  if (file?.filename) return { ...data, icon: file.filename };
  if (typeof data.icon === "string" && data.icon.startsWith("blob:")) {
    const next = { ...data };
    delete next.icon;
    return next;
  }
  return data;
}

const optionalPositiveId = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (value === null || value === "" || value === "null") return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : value;
}, z.number().int().positive().nullable().optional());

function normalizeSpecs(value) {
  if (value === undefined) return undefined;
  const parsed = parseJson(value, {});
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const specs = {};
  for (const [key, val] of Object.entries(parsed)) {
    const name = String(key).trim();
    const text = val == null ? "" : String(val).trim();
    if (name && text) specs[name] = text;
  }
  return specs;
}

async function ensureSubcategory(categoryId, subCategoryId) {
  if (subCategoryId == null) return;
  const sub = await prisma.subCategory.findFirst({
    where: { id: subCategoryId, categoryId },
  });
  if (!sub) throw new ApiError(400, "Subkategoriya tanlangan kategoriyaga tegishli emas");
}

function productInclude() {
  return {
    seller: true,
    category: true,
    subCategory: true,
  };
}

function buildPublicProductWhere(query) {
  const where = {
    status: "active",
    moderationStatus: "approved",
  };

  if (query.q) {
    const q = String(query.q);
    where.OR = [
      { name: { contains: q } },
      { description: { contains: q } },
      { brand: { contains: q } },
    ];
  }
  if (query.category) {
    const catId = Number(query.category);
    if (!Number.isNaN(catId)) where.categoryId = catId;
    else where.category = { name: String(query.category) };
  }
  if (query.sellerId) where.sellerId = Number(query.sellerId);
  if (query.minPrice) where.price = { ...(where.price || {}), gte: Number(query.minPrice) };
  if (query.maxPrice) where.price = { ...(where.price || {}), lte: Number(query.maxPrice) };
  if (query.minRating) where.rating = { gte: Number(query.minRating) };
  if (query.onSale === "true" || query.onSale === "1") where.discount = { gt: 0 };
  if (query.verifiedSeller === "true") where.seller = { verified: true };

  return where;
}

function sortProducts(sort) {
  switch (sort) {
    case "newest":
      return { createdAt: "desc" };
    case "price-asc":
      return { price: "asc" };
    case "price-desc":
      return { price: "desc" };
    case "rating":
      return { rating: "desc" };
    case "popular":
      return { ordersCount: "desc" };
    default:
      return { createdAt: "desc" };
  }
}

export const listProducts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = buildPublicProductWhere(req.query);
  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: sortProducts(req.query.sort),
      include: productInclude(),
    }),
  ]);
  return ok(res, products.map(serializeProduct), paginationMeta(total, page, limit));
});

export const getProduct = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const product = await prisma.product.findFirst({
    where: {
      id,
      OR: [
        { status: "active", moderationStatus: "approved" },
        ...(req.user?.role === "admin" ? [{}] : []),
        ...(req.user?.seller ? [{ sellerId: req.user.seller.id }] : []),
      ],
    },
    include: productInclude(),
  });
  if (!product) throw new ApiError(404, "Mahsulot topilmadi");

  await prisma.product.update({
    where: { id },
    data: { views: { increment: 1 } },
  });
  product.views += 1;

  return ok(res, serializeProduct(product));
});

export const similarProducts = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new ApiError(404, "Mahsulot topilmadi");

  const items = await prisma.product.findMany({
    where: {
      id: { not: id },
      categoryId: product.categoryId,
      status: "active",
      moderationStatus: "approved",
    },
    take: 8,
    orderBy: { rating: "desc" },
    include: productInclude(),
  });
  return ok(res, items.map(serializeProduct));
});

export const sellerListProducts = asyncHandler(async (req, res) => {
  const sellerId = req.user.seller.id;
  const { page, limit, skip } = paginate(req.query);
  const where = { sellerId };
  if (req.query.status) where.status = req.query.status;
  if (req.query.q) where.name = { contains: String(req.query.q) };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: productInclude(),
    }),
  ]);
  return ok(res, products.map(serializeProduct), paginationMeta(total, page, limit));
});

export const sellerGetProduct = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const product = await prisma.product.findFirst({
    where: { id, sellerId: req.user.seller.id },
    include: productInclude(),
  });
  if (!product) throw new ApiError(404, "Mahsulot topilmadi");
  return ok(res, serializeProduct(product));
});

export const sellerCreateProduct = asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    categoryId: z.coerce.number().int().positive(),
    subCategoryId: optionalPositiveId,
    brand: z.string().optional().nullable(),
    description: z.string().min(10).max(2000),
    price: z.coerce.number().int().positive(),
    oldPrice: z.coerce.number().int().positive().optional().nullable(),
    stock: z.coerce.number().int().min(0).default(0),
    sku: z.string().optional().nullable(),
    location: z.string().optional().nullable(),
    specs: z.any().optional(),
    status: z.enum(["draft", "active", "inactive", "archived"]).default("draft"),
  });

  const data = schema.parse(req.body);
  await ensureSubcategory(data.categoryId, data.subCategoryId);
  const discount =
    data.oldPrice && data.oldPrice > data.price
      ? Math.round(((data.oldPrice - data.price) / data.oldPrice) * 100)
      : 0;

  const files = req.files || [];
  const imagePaths = files.map((f) => f.filename);
  const image = imagePaths[0] || null;

  const product = await prisma.product.create({
    data: {
      sellerId: req.user.seller.id,
      categoryId: data.categoryId,
      subCategoryId: data.subCategoryId || null,
      name: data.name,
      brand: data.brand || null,
      description: data.description,
      price: data.price,
      oldPrice: data.oldPrice || null,
      discount,
      stock: data.stock,
      sku: data.sku || null,
      location: data.location || req.user.seller.location,
      image,
      images: toJson(imagePaths),
      specs: toJson(normalizeSpecs(data.specs) || {}),
      status: data.status,
      moderationStatus: data.status === "active" ? "approved" : "pending",
    },
    include: productInclude(),
  });

  return created(res, serializeProduct(product));
});

export const sellerUpdateProduct = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.product.findFirst({
    where: { id, sellerId: req.user.seller.id },
  });
  if (!existing) throw new ApiError(404, "Mahsulot topilmadi");

  const schema = z.object({
    name: z.string().min(2).optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    subCategoryId: optionalPositiveId,
    brand: z.string().optional().nullable(),
    description: z.string().min(10).max(2000).optional(),
    price: z.coerce.number().int().positive().optional(),
    oldPrice: z.coerce.number().int().positive().optional().nullable(),
    stock: z.coerce.number().int().min(0).optional(),
    sku: z.string().optional().nullable(),
    location: z.string().optional().nullable(),
    specs: z.any().optional(),
    status: z.enum(["draft", "active", "inactive", "archived"]).optional(),
  });
  const data = schema.parse(req.body);
  const categoryId = data.categoryId ?? existing.categoryId;
  if (data.subCategoryId !== undefined) {
    await ensureSubcategory(categoryId, data.subCategoryId);
  }

  const price = data.price ?? existing.price;
  const oldPrice = data.oldPrice !== undefined ? data.oldPrice : existing.oldPrice;
  const discount =
    oldPrice && oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;

  const files = req.files || [];
  const normalizedSpecs = normalizeSpecs(data.specs);
  const update = {
    ...data,
    discount,
  };
  delete update.specs;
  if (normalizedSpecs !== undefined) update.specs = toJson(normalizedSpecs);

  if (files.length) {
    const imagePaths = files.map((f) => f.filename);
    update.image = imagePaths[0];
    update.images = toJson(imagePaths);
  }

  // Seller "Faol" holati sayt katalogiga chiqishi uchun tasdiqlangan bo'lishi kerak.
  if (data.status === "active") {
    update.moderationStatus = "approved";
  }

  const product = await prisma.product.update({
    where: { id },
    data: update,
    include: productInclude(),
  });
  return ok(res, serializeProduct(product));
});

export const sellerDeleteProduct = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.product.findFirst({
    where: { id, sellerId: req.user.seller.id },
  });
  if (!existing) throw new ApiError(404, "Mahsulot topilmadi");

  // OrderItem has no onDelete cascade — archive instead of hard-delete when orders exist
  const orderItemCount = await prisma.orderItem.count({ where: { productId: id } });
  if (orderItemCount > 0) {
    const product = await prisma.product.update({
      where: { id },
      data: { status: "archived" },
      include: productInclude(),
    });
    return ok(res, {
      message: "Mahsulotda buyurtmalar bor, shuning uchun arxivlandi",
      softDeleted: true,
      product: serializeProduct(product),
    });
  }

  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { productId: id } }),
    prisma.favorite.deleteMany({ where: { productId: id } }),
    prisma.review.deleteMany({ where: { productId: id } }),
    prisma.product.delete({ where: { id } }),
  ]);
  return ok(res, { message: "Mahsulot o'chirildi", softDeleted: false });
});

export const adminListProducts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = {};
  if (req.query.moderation) where.moderationStatus = req.query.moderation;
  if (req.query.status) where.status = req.query.status;
  if (req.query.q) where.name = { contains: String(req.query.q) };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: productInclude(),
    }),
  ]);
  return ok(res, products.map(serializeProduct), paginationMeta(total, page, limit));
});

export const adminModerateProduct = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const action = req.params.action;
  if (!["approve", "reject"].includes(action)) {
    throw new ApiError(400, "action: approve | reject");
  }
  const product = await prisma.product.update({
    where: { id },
    data: {
      moderationStatus: action === "approve" ? "approved" : "rejected",
      ...(action === "approve" ? { status: "active" } : {}),
    },
    include: productInclude(),
  });
  return ok(res, serializeProduct(product));
});

// Categories
export const listCategories = asyncHandler(async (_req, res) => {
  const cats = await prisma.category.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    include: {
      subcategories: { where: { active: true } },
      _count: { select: { products: true } },
    },
  });
  return ok(res, cats.map(serializeCategory));
});

export const adminListCategories = asyncHandler(async (_req, res) => {
  const cats = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      subcategories: true,
      _count: { select: { products: true } },
    },
  });
  return ok(res, cats.map(serializeCategory));
});

export const adminCreateCategory = asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    icon: z.string().optional(),
    color: z.string().optional(),
    bg: z.string().optional(),
    active: boolFromBody,
    sortOrder: z.preprocess(
      (value) => (value === undefined || value === null || value === "" ? undefined : Number(value)),
      z.number().int().optional(),
    ),
  });
  const data = withUploadedIcon(schema.parse(req.body), req.file);
  const cat = await prisma.category.create({
    data,
    include: { subcategories: true, _count: { select: { products: true } } },
  });
  return created(res, serializeCategory(cat));
});

export const adminUpdateCategory = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const schema = z.object({
    name: z.string().min(1).optional(),
    icon: z.string().optional().nullable(),
    color: z.string().optional(),
    bg: z.string().optional(),
    active: boolFromBody,
    sortOrder: z.preprocess(
      (value) => (value === undefined || value === null || value === "" ? undefined : Number(value)),
      z.number().int().optional(),
    ),
  });
  const data = withUploadedIcon(schema.parse(req.body), req.file);
  const cat = await prisma.category.update({
    where: { id },
    data,
    include: { subcategories: true, _count: { select: { products: true } } },
  });
  return ok(res, serializeCategory(cat));
});

export const adminDeleteCategory = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await prisma.category.delete({ where: { id } });
  return ok(res, { message: "Kategoriya o'chirildi" });
});

export const adminCreateSubcategory = asyncHandler(async (req, res) => {
  const categoryId = Number(req.params.id);
  const schema = z.object({
    name: z.string().min(1),
    icon: z.string().optional(),
    active: boolFromBody,
  });
  const data = withUploadedIcon(schema.parse(req.body), req.file);
  const sub = await prisma.subCategory.create({
    data: { ...data, categoryId },
  });
  return created(res, serializeSubcategory(sub));
});

export const adminUpdateSubcategory = asyncHandler(async (req, res) => {
  const id = Number(req.params.subId);
  const schema = z.object({
    name: z.string().min(1).optional(),
    icon: z.string().optional().nullable(),
    active: boolFromBody,
  });
  const data = withUploadedIcon(schema.parse(req.body), req.file);
  const sub = await prisma.subCategory.update({ where: { id }, data });
  return ok(res, serializeSubcategory(sub));
});

export const adminDeleteSubcategory = asyncHandler(async (req, res) => {
  const id = Number(req.params.subId);
  await prisma.subCategory.delete({ where: { id } });
  return ok(res, { message: "Subkategoriya o'chirildi" });
});
