import { z } from "zod";
import { prisma } from "../config/db.js";
import {
  ApiError,
  asyncHandler,
  created,
  ok,
  paginate,
  paginationMeta,
  txnId,
} from "../utils/helpers.js";
import { serializePayment, serializePlan } from "../utils/serializers.js";

export const sellerPayments = asyncHandler(async (req, res) => {
  const sellerId = req.user.seller.id;
  const { page, limit, skip } = paginate(req.query);

  const where = { sellerId };
  if (req.query.status) where.status = req.query.status;
  if (req.query.type) where.type = req.query.type;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [total, payments, totalRevenue, thisMonth, pending, refunded] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.aggregate({
      where: { sellerId, type: "sale", status: "confirmed" },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { sellerId, type: "sale", status: "confirmed", createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { sellerId, status: "pending" },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { sellerId, status: "refunded" },
      _sum: { amount: true },
    }),
  ]);

  return ok(
    res,
    {
      kpis: {
        totalRevenue: totalRevenue._sum.amount || 0,
        thisMonth: thisMonth._sum.amount || 0,
        pending: pending._sum.amount || 0,
        refunded: refunded._sum.amount || 0,
      },
      payments: payments.map(serializePayment),
    },
    paginationMeta(total, page, limit),
  );
});

export const sellerTopup = asyncHandler(async (req, res) => {
  const schema = z.object({
    amount: z.coerce.number().int().positive(),
    method: z.enum(["payme", "click", "uzum", "paynet", "card"]),
    label: z.string().optional(),
  });
  const data = schema.parse(req.body);

  const payment = await prisma.payment.create({
    data: {
      transactionId: txnId("TOP"),
      sellerId: req.user.seller.id,
      userId: req.user.id,
      type: "topup",
      amount: data.amount,
      method: data.method,
      status: "confirmed",
      description: data.label || "Hisob to'ldirish",
    },
  });

  return created(res, serializePayment(payment));
});

export const adminPayments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.type) where.type = req.query.type;

  const settings = await prisma.platformSettings.findUnique({ where: { id: 1 } });
  const commissionPct = settings?.commissionPct ?? 5;

  const [total, payments, salesAgg, refundAgg] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.aggregate({
      where: { type: "sale", status: "confirmed" },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: "refunded" },
      _sum: { amount: true },
    }),
  ]);

  const gmv = salesAgg._sum.amount || 0;
  return ok(
    res,
    {
      kpis: {
        gmv,
        commission: Math.round((gmv * commissionPct) / 100),
        refunds: refundAgg._sum.amount || 0,
        commissionPct,
      },
      payments: payments.map(serializePayment),
    },
    paginationMeta(total, page, limit),
  );
});

export const listPlans = asyncHandler(async (_req, res) => {
  const plans = await prisma.subscriptionPlan.findMany({
    where: { active: true },
    include: { _count: { select: { subscriptions: true } } },
    orderBy: { monthlyPrice: "asc" },
  });
  return ok(res, plans.map(serializePlan));
});

export const getSellerSubscription = asyncHandler(async (req, res) => {
  const seller = await prisma.seller.findUnique({ where: { id: req.user.seller.id } });
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: seller.planId },
    include: { _count: { select: { subscriptions: true } } },
  });
  const history = await prisma.sellerSubscription.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const daysLeft = seller.planExpiresAt
    ? Math.max(0, Math.ceil((new Date(seller.planExpiresAt) - new Date()) / 86400000))
    : 0;

  return ok(res, {
    plan: serializePlan(plan),
    status: "active",
    billingCycle: seller.billingCycle,
    expiresAt: seller.planExpiresAt,
    daysLeft,
    history,
  });
});

export const subscribeSeller = asyncHandler(async (req, res) => {
  const schema = z.object({
    planId: z.enum(["start", "business", "pro"]),
    billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
    paymentMethod: z.enum(["payme", "click", "uzum", "paynet", "card"]),
  });
  const data = schema.parse(req.body);

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: data.planId } });
  if (!plan || !plan.active) throw new ApiError(404, "Tarif topilmadi");

  const amount = data.billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  const expiresAt = new Date();
  if (data.billingCycle === "yearly") expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  else expiresAt.setMonth(expiresAt.getMonth() + 1);

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        transactionId: txnId("SUB"),
        sellerId: req.user.seller.id,
        userId: req.user.id,
        type: "subscription",
        amount,
        method: data.paymentMethod,
        status: "confirmed",
        description: `${plan.name} — ${data.billingCycle}`,
      },
    });

    const sub = await tx.sellerSubscription.create({
      data: {
        sellerId: req.user.seller.id,
        planId: data.planId,
        billingCycle: data.billingCycle,
        expiresAt,
        paymentId: payment.id,
      },
    });

    await tx.seller.update({
      where: { id: req.user.seller.id },
      data: {
        planId: data.planId,
        billingCycle: data.billingCycle,
        planExpiresAt: expiresAt,
      },
    });

    return { payment, sub, plan };
  });

  return created(res, {
    subscription: result.sub,
    payment: serializePayment(result.payment),
    plan: serializePlan(result.plan),
  });
});

export const adminListPlans = asyncHandler(async (_req, res) => {
  const plans = await prisma.subscriptionPlan.findMany({
    include: { _count: { select: { subscriptions: true } } },
    orderBy: { monthlyPrice: "asc" },
  });
  return ok(res, plans.map(serializePlan));
});

export const adminUpsertPlan = asyncHandler(async (req, res) => {
  const schema = z.object({
    id: z.enum(["start", "business", "pro"]),
    name: z.string().min(1),
    monthlyPrice: z.coerce.number().int().min(0),
    yearlyPrice: z.coerce.number().int().min(0),
    color: z.string().optional(),
    popular: z.boolean().optional(),
    features: z.array(z.string()).optional(),
    limits: z.string().optional(),
    productLimit: z.coerce.number().int().optional(),
    active: z.boolean().optional(),
  });
  const data = schema.parse(req.body);

  const plan = await prisma.subscriptionPlan.upsert({
    where: { id: data.id },
    create: {
      id: data.id,
      name: data.name,
      monthlyPrice: data.monthlyPrice,
      yearlyPrice: data.yearlyPrice,
      color: data.color || "#1A3A6E",
      popular: data.popular || false,
      features: JSON.stringify(data.features || []),
      limits: data.limits || "",
      productLimit: data.productLimit ?? 50,
      active: data.active ?? true,
    },
    update: {
      name: data.name,
      monthlyPrice: data.monthlyPrice,
      yearlyPrice: data.yearlyPrice,
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.popular !== undefined ? { popular: data.popular } : {}),
      ...(data.features !== undefined ? { features: JSON.stringify(data.features) } : {}),
      ...(data.limits !== undefined ? { limits: data.limits } : {}),
      ...(data.productLimit !== undefined ? { productLimit: data.productLimit } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    },
    include: { _count: { select: { subscriptions: true } } },
  });

  return ok(res, serializePlan(plan));
});
