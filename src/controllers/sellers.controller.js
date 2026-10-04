import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../config/db.js";
import {
  ApiError,
  asyncHandler,
  created,
  normalizePhone,
  ok,
  paginate,
  paginationMeta,
  slugify,
} from "../utils/helpers.js";
import { serializeProduct, serializeSeller } from "../utils/serializers.js";

const boolFromBody = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return value;
}, z.boolean().optional());

async function withSellerStats(seller) {
  const [productCount, reviewAgg, ordersCount] = await Promise.all([
    prisma.product.count({
      where: { sellerId: seller.id, status: "active", moderationStatus: "approved" },
    }),
    prisma.review.aggregate({
      where: { sellerId: seller.id },
      _avg: { rating: true },
      _count: true,
    }),
    prisma.order.count({ where: { sellerId: seller.id } }),
  ]);
  return serializeSeller({
    ...seller,
    productCount,
    rating: Math.round((reviewAgg._avg.rating || 0) * 10) / 10,
    reviewCount: reviewAgg._count,
    ordersCount,
  });
}

export const listSellers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = { status: "active" };
  if (req.query.q) where.name = { contains: String(req.query.q) };

  const [total, sellers] = await Promise.all([
    prisma.seller.count({ where }),
    prisma.seller.findMany({
      where,
      skip,
      take: limit,
      orderBy: { salesTotal: "desc" },
    }),
  ]);

  const data = await Promise.all(sellers.map(withSellerStats));
  return ok(res, data, paginationMeta(total, page, limit));
});

export const getStoreBySlug = asyncHandler(async (req, res) => {
  const seller = await prisma.seller.findUnique({ where: { slug: req.params.slug } });
  if (!seller || (seller.status !== "active" && req.user?.role !== "admin")) {
    throw new ApiError(404, "Do'kon topilmadi");
  }

  const tab = req.query.tab || "all";
  const productWhere = {
    sellerId: seller.id,
    status: "active",
    moderationStatus: "approved",
  };
  if (tab === "sale") productWhere.discount = { gt: 0 };
  if (tab === "new") {
    /* newest sort */
  }
  if (tab === "popular") {
    /* popular sort */
  }

  let orderBy = { createdAt: "desc" };
  if (tab === "popular") orderBy = { ordersCount: "desc" };
  if (tab === "new") orderBy = { createdAt: "desc" };

  const products = await prisma.product.findMany({
    where: productWhere,
    orderBy,
    take: 48,
    include: { seller: true, category: true },
  });

  const store = await withSellerStats(seller);
  return ok(res, {
    store,
    products: products.map(serializeProduct),
  });
});

export const getSellerSettings = asyncHandler(async (req, res) => {
  const seller = await prisma.seller.findUnique({ where: { id: req.user.seller.id } });
  return ok(res, serializeSeller(seller));
});

export const updateSellerSettings = asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().min(2).optional(),
    description: z.string().optional().nullable(),
    phone: z.string().optional(),
    email: z.string().email().optional().nullable(),
    location: z.string().optional().nullable(),
    workingHours: z.string().optional(),
    minOrderAmount: z.coerce.number().int().min(0).optional(),
    deliveryTimeframe: z.string().optional(),
    freeDeliveryThreshold: z.coerce.number().int().min(0).optional(),
    notifyNewOrder: z.boolean().optional(),
    notifyNewReview: z.boolean().optional(),
    notifyLowStock: z.boolean().optional(),
    notifyPayment: z.boolean().optional(),
  });
  const data = schema.parse(req.body);
  if (data.phone) data.phone = normalizePhone(data.phone);

  const seller = await prisma.seller.update({
    where: { id: req.user.seller.id },
    data,
  });
  return ok(res, serializeSeller(seller));
});

export const adminListSellers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.q) {
    where.OR = [
      { name: { contains: String(req.query.q) } },
      { phone: { contains: String(req.query.q) } },
      { email: { contains: String(req.query.q) } },
    ];
  }

  const [total, sellers] = await Promise.all([
    prisma.seller.count({ where }),
    prisma.seller.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { user: true, _count: { select: { products: true, orders: true } } },
    }),
  ]);

  const data = await Promise.all(sellers.map(withSellerStats));
  return ok(res, data, paginationMeta(total, page, limit));
});

export const adminCreateSeller = asyncHandler(async (req, res) => {
  const schema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().min(9),
    email: z.string().email().optional().nullable(),
    password: z.preprocess(
      (value) => (value === undefined || value === null || value === "" ? undefined : value),
      z.string().min(8).default("Seller123!"),
    ),
    storeName: z.string().min(2),
    location: z.string().optional(),
    description: z.string().optional(),
    businessType: z.enum(["individual", "yatt", "mchj", "aj"]).optional(),
    planId: z.enum(["start", "business", "pro"]).optional(),
    status: z.enum(["active", "pending", "blocked", "suspended"]).optional(),
    verified: boolFromBody,
  });
  const data = schema.parse(req.body);
  const phone = normalizePhone(data.phone);

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) throw new ApiError(409, "Bu telefon band");

  let slug = slugify(data.storeName);
  if (await prisma.seller.findUnique({ where: { slug } })) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const expires = new Date();
  expires.setMonth(expires.getMonth() + 1);

  const user = await prisma.user.create({
    data: {
      phone,
      email: data.email || null,
      passwordHash: await bcrypt.hash(data.password, 10),
      firstName: data.firstName,
      lastName: data.lastName,
      role: "seller",
      city: data.location || null,
      seller: {
        create: {
          name: data.storeName,
          slug,
          logo: req.file?.filename || null,
          description: data.description || null,
          location: data.location || null,
          phone,
          email: data.email || null,
          businessType: data.businessType || "individual",
          status: data.status || "active",
          verified: data.verified ?? false,
          planId: data.planId || "start",
          planExpiresAt: expires,
        },
      },
    },
    include: { seller: true },
  });

  return created(res, await withSellerStats(user.seller));
});

export const adminUpdateSeller = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.seller.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!existing) throw new ApiError(404, "Sotuvchi topilmadi");

  const emptyToUndefined = (value) =>
    value === undefined || value === null || value === "" ? undefined : value;

  const schema = z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    phone: z.string().min(9).optional(),
    email: z.preprocess(emptyToUndefined, z.string().email().optional().nullable()),
    password: z.preprocess(emptyToUndefined, z.string().min(8).optional()),
    storeName: z.string().min(2).optional(),
    name: z.string().min(2).optional(),
    description: z.string().optional().nullable(),
    location: z.string().optional().nullable(),
    status: z.enum(["active", "pending", "blocked", "suspended"]).optional(),
    verified: boolFromBody,
    planId: z.enum(["start", "business", "pro"]).optional(),
  });
  const data = schema.parse(req.body);
  const phone = data.phone ? normalizePhone(data.phone) : undefined;

  if (phone && phone !== existing.user.phone) {
    const taken = await prisma.user.findUnique({ where: { phone } });
    if (taken) throw new ApiError(409, "Bu telefon band");
  }
  if (data.email && data.email !== existing.user.email) {
    const taken = await prisma.user.findUnique({ where: { email: data.email } });
    if (taken && taken.id !== existing.userId) throw new ApiError(409, "Bu email band");
  }

  const storeName = data.storeName || data.name;
  let slug = existing.slug;
  if (storeName && storeName !== existing.name) {
    slug = slugify(storeName);
    const clash = await prisma.seller.findUnique({ where: { slug } });
    if (clash && clash.id !== existing.id) slug = `${slug}-${Date.now().toString(36)}`;
  }

  await prisma.user.update({
    where: { id: existing.userId },
    data: {
      ...(data.firstName ? { firstName: data.firstName } : {}),
      ...(data.lastName ? { lastName: data.lastName } : {}),
      ...(phone ? { phone } : {}),
      ...(data.email !== undefined ? { email: data.email || null } : {}),
      ...(data.location !== undefined ? { city: data.location } : {}),
      ...(data.password ? { passwordHash: await bcrypt.hash(data.password, 10) } : {}),
    },
  });

  const seller = await prisma.seller.update({
    where: { id },
    data: {
      ...(storeName ? { name: storeName, slug } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.location !== undefined ? { location: data.location } : {}),
      ...(phone ? { phone } : {}),
      ...(data.email !== undefined ? { email: data.email || null } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(data.verified !== undefined ? { verified: data.verified } : {}),
      ...(data.planId ? { planId: data.planId } : {}),
      ...(req.file ? { logo: req.file.filename } : {}),
    },
    include: { user: true, _count: { select: { products: true, orders: true } } },
  });
  return ok(res, await withSellerStats(seller));
});

export const adminDeleteSeller = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const seller = await prisma.seller.findUnique({ where: { id } });
  if (!seller) throw new ApiError(404, "Sotuvchi topilmadi");
  await prisma.user.delete({ where: { id: seller.userId } });
  return ok(res, { message: "Sotuvchi o'chirildi" });
});
