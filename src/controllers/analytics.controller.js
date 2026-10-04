import { z } from "zod";
import { prisma } from "../config/db.js";
import { asyncHandler, ok, REGIONS } from "../utils/helpers.js";
import { serializeCategory, serializeProduct, serializeSeller } from "../utils/serializers.js";

const MONTHS_UZ = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];

function monthKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

export const home = asyncHandler(async (_req, res) => {
  const [
    categories,
    recommended,
    newest,
    onSale,
    sellers,
    promotions,
    productCount,
    sellerCount,
    userCount,
  ] = await Promise.all([
    prisma.category.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      include: { subcategories: true, _count: { select: { products: true } } },
    }),
    prisma.product.findMany({
      where: { status: "active", moderationStatus: "approved" },
      orderBy: [{ rating: "desc" }, { ordersCount: "desc" }],
      take: 8,
      include: { seller: true, category: true },
    }),
    prisma.product.findMany({
      where: { status: "active", moderationStatus: "approved" },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { seller: true, category: true },
    }),
    prisma.product.findMany({
      where: { status: "active", moderationStatus: "approved", discount: { gt: 0 } },
      orderBy: { discount: "desc" },
      take: 8,
      include: { seller: true, category: true },
    }),
    prisma.seller.findMany({
      where: { status: "active" },
      orderBy: { salesTotal: "desc" },
      take: 6,
    }),
    prisma.promotion.findMany({
      where: {
        status: "active",
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
      take: 5,
    }),
    prisma.product.count({ where: { status: "active", moderationStatus: "approved" } }),
    prisma.seller.count({ where: { status: "active" } }),
    prisma.user.count({ where: { role: "customer", active: true } }),
  ]);

  const sellersWithStats = await Promise.all(
    sellers.map(async (s) => {
      const [productCountS, reviewAgg] = await Promise.all([
        prisma.product.count({
          where: { sellerId: s.id, status: "active", moderationStatus: "approved" },
        }),
        prisma.review.aggregate({
          where: { sellerId: s.id },
          _avg: { rating: true },
          _count: true,
        }),
      ]);
      return serializeSeller({
        ...s,
        productCount: productCountS,
        rating: Math.round((reviewAgg._avg.rating || 0) * 10) / 10,
        reviewCount: reviewAgg._count,
      });
    }),
  );

  return ok(res, {
    categories: categories.map(serializeCategory),
    feeds: {
      recommended: recommended.map(serializeProduct),
      newest: newest.map(serializeProduct),
      onSale: onSale.map(serializeProduct),
    },
    sellers: sellersWithStats,
    promotions,
    stats: {
      products: productCount,
      sellers: sellerCount,
      customers: userCount,
    },
    regions: REGIONS,
  });
});

export const sellerAnalytics = asyncHandler(async (req, res) => {
  const sellerId = req.user.seller.id;
  const period = req.query.period || "month";

  const since = new Date();
  if (period === "week") since.setDate(since.getDate() - 7);
  else if (period === "year") since.setFullYear(since.getFullYear() - 1);
  else since.setMonth(since.getMonth() - 11);

  const orders = await prisma.order.findMany({
    where: {
      sellerId,
      status: { not: "cancelled" },
      createdAt: { gte: since },
    },
    select: { total: true, createdAt: true, status: true },
  });

  const buckets = new Map();
  for (const o of orders) {
    const d = new Date(o.createdAt);
    const key = period === "week"
      ? d.toISOString().slice(0, 10)
      : `${d.getFullYear()}-${d.getMonth()}`;
    if (!buckets.has(key)) buckets.set(key, { revenue: 0, orders: 0, label: key });
    const b = buckets.get(key);
    b.revenue += o.total;
    b.orders += 1;
  }

  const series = [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => {
      if (period !== "week" && v.label.includes("-")) {
        const m = Number(v.label.split("-")[1]);
        return { month: MONTHS_UZ[m] || v.label, revenue: v.revenue, orders: v.orders };
      }
      return { month: v.label, revenue: v.revenue, orders: v.orders };
    });

  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const views = await prisma.product.aggregate({
    where: { sellerId },
    _sum: { views: true },
  });
  const lowStock = await prisma.product.findMany({
    where: { sellerId, stock: { lte: 5 }, status: { not: "archived" } },
    take: 10,
    orderBy: { stock: "asc" },
  });

  return ok(res, {
    kpis: {
      revenue,
      orders: orders.length,
      views: views._sum.views || 0,
      avgOrderValue: orders.length ? Math.round(revenue / orders.length) : 0,
      conversion: views._sum.views
        ? Math.round((orders.length / views._sum.views) * 1000) / 10
        : 0,
    },
    series,
    lowStock: lowStock.map((p) => ({
      id: p.id,
      name: p.name,
      stock: p.stock,
      image: p.image,
    })),
  });
});

export const adminAnalytics = asyncHandler(async (_req, res) => {
  const since = new Date();
  since.setMonth(since.getMonth() - 11);

  const [orders, users, sellers, payments] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: since }, status: { not: "cancelled" } },
      select: { total: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: since }, role: "customer" },
      select: { createdAt: true },
    }),
    prisma.seller.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.payment.aggregate({
      where: { type: "sale", status: "confirmed" },
      _sum: { amount: true },
    }),
  ]);

  const map = new Map();
  const ensure = (d) => {
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!map.has(key)) {
      map.set(key, {
        month: MONTHS_UZ[d.getMonth()],
        sellers: 0,
        users: 0,
        revenue: 0,
        key,
      });
    }
    return map.get(key);
  };

  for (const o of orders) ensure(new Date(o.createdAt)).revenue += o.total;
  for (const u of users) ensure(new Date(u.createdAt)).users += 1;
  for (const s of sellers) ensure(new Date(s.createdAt)).sellers += 1;

  const series = [...map.values()].sort((a, b) => a.key.localeCompare(b.key));

  const [totalUsers, totalSellers, totalProducts, totalOrders] = await Promise.all([
    prisma.user.count({ where: { role: "customer" } }),
    prisma.seller.count(),
    prisma.product.count(),
    prisma.order.count(),
  ]);

  return ok(res, {
    kpis: {
      revenue: payments._sum.amount || 0,
      users: totalUsers,
      sellers: totalSellers,
      products: totalProducts,
      orders: totalOrders,
    },
    series,
  });
});

export const sellerOverview = asyncHandler(async (req, res) => {
  const sellerId = req.user.seller.id;
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [ordersMonth, revenueMonth, products, pendingOrders, recentOrders] = await Promise.all([
    prisma.order.count({
      where: { sellerId, createdAt: { gte: startOfMonth }, status: { not: "cancelled" } },
    }),
    prisma.order.aggregate({
      where: { sellerId, createdAt: { gte: startOfMonth }, status: { not: "cancelled" } },
      _sum: { total: true },
    }),
    prisma.product.count({ where: { sellerId } }),
    prisma.order.count({ where: { sellerId, status: "new" } }),
    prisma.order.findMany({
      where: { sellerId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { items: true, customer: true },
    }),
  ]);

  return ok(res, {
    kpis: {
      ordersThisMonth: ordersMonth,
      revenueThisMonth: revenueMonth._sum.total || 0,
      products,
      pendingOrders,
    },
    recentOrders,
  });
});

export const adminOverview = asyncHandler(async (_req, res) => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    users,
    sellers,
    products,
    orders,
    pendingProducts,
    pendingSellers,
    revenueMonth,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "customer" } }),
    prisma.seller.count(),
    prisma.product.count(),
    prisma.order.count(),
    prisma.product.count({ where: { moderationStatus: "pending" } }),
    prisma.seller.count({ where: { status: "pending" } }),
    prisma.payment.aggregate({
      where: { type: "sale", status: "confirmed", createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
  ]);

  return ok(res, {
    kpis: {
      users,
      sellers,
      products,
      orders,
      pendingProducts,
      pendingSellers,
      revenueThisMonth: revenueMonth._sum.amount || 0,
    },
  });
});

export const getPlatformSettings = asyncHandler(async (_req, res) => {
  let settings = await prisma.platformSettings.findUnique({ where: { id: 1 } });
  if (!settings) {
    settings = await prisma.platformSettings.create({ data: { id: 1 } });
  }
  return ok(res, settings);
});

export const updatePlatformSettings = asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().optional(),
    supportEmail: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    commissionPct: z.coerce.number().min(0).max(100).optional(),
    minPayout: z.coerce.number().int().min(0).optional(),
    payoutDelayDays: z.coerce.number().int().min(0).optional(),
    mandatory2FA: z.boolean().optional(),
    autoApproveSellers: z.boolean().optional(),
    fraudMonitoring: z.boolean().optional(),
    maintenanceMode: z.boolean().optional(),
    notifyNewSeller: z.boolean().optional(),
    notifyNewOrder: z.boolean().optional(),
    notifyRefund: z.boolean().optional(),
  });
  const data = schema.parse(req.body);
  const settings = await prisma.platformSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });
  return ok(res, settings);
});

export const getRegions = asyncHandler(async (_req, res) => {
  return ok(res, REGIONS);
});
