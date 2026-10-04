import { z } from "zod";
import { prisma } from "../config/db.js";
import {
  ApiError,
  asyncHandler,
  created,
  normalizePhone,
  ok,
  orderNumber,
  paginate,
  paginationMeta,
  txnId,
} from "../utils/helpers.js";
import { serializeOrder } from "../utils/serializers.js";

const DELIVERY_FEES = { standard: 25000, express: 50000, pickup: 0 };

const orderInclude = {
  items: { include: { product: { include: { seller: true, category: true } } } },
  seller: true,
  customer: true,
};

export const createOrder = asyncHandler(async (req, res) => {
  const schema = z.object({
    items: z
      .array(
        z.object({
          productId: z.coerce.number().int().positive(),
          quantity: z.coerce.number().int().min(1),
        }),
      )
      .min(1)
      .optional(),
    fromCart: z.boolean().optional(),
    recipientName: z.string().min(2),
    recipientPhone: z.string().min(9),
    region: z.string().min(1),
    address: z.string().min(3),
    deliveryMethod: z.enum(["standard", "express", "pickup"]).default("standard"),
    paymentMethod: z.enum(["payme", "click", "uzum", "paynet", "card"]),
    promoCode: z.string().optional().nullable(),
    note: z.string().optional().nullable(),
  });
  const data = schema.parse(req.body);

  let lineItems = data.items || [];
  if (data.fromCart || !lineItems.length) {
    const cart = await prisma.cartItem.findMany({ where: { userId: req.user.id } });
    if (!cart.length) throw new ApiError(400, "Savat bo'sh");
    lineItems = cart.map((c) => ({ productId: c.productId, quantity: c.quantity }));
  }

  const productIds = lineItems.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, status: "active", moderationStatus: "approved" },
    include: { seller: true },
  });
  if (products.length !== productIds.length) {
    throw new ApiError(400, "Ba'zi mahsulotlar mavjud emas");
  }

  const bySeller = new Map();
  for (const line of lineItems) {
    const product = products.find((p) => p.id === line.productId);
    if (product.stock < line.quantity) {
      throw new ApiError(400, `"${product.name}" omborda yetarli emas`);
    }
    if (!bySeller.has(product.sellerId)) bySeller.set(product.sellerId, []);
    bySeller.get(product.sellerId).push({ product, quantity: line.quantity });
  }

  let discountPct = 0;
  if (data.promoCode) {
    const promo = await prisma.promotion.findFirst({
      where: {
        promoCode: data.promoCode.toUpperCase(),
        status: "active",
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
    });
    if (promo) {
      discountPct = promo.discountPct || 0;
      await prisma.promotion.update({
        where: { id: promo.id },
        data: { conversions: { increment: 1 } },
      });
    }
  }

  const deliveryFee = DELIVERY_FEES[data.deliveryMethod] ?? 25000;
  const createdOrders = [];

  await prisma.$transaction(async (tx) => {
    for (const [sellerId, lines] of bySeller.entries()) {
      const subtotal = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);
      const discountAmount = Math.round((subtotal * discountPct) / 100);
      // delivery fee once per checkout shared to first seller order only — apply full fee to each for simplicity? Apply once to first.
      const fee = createdOrders.length === 0 ? deliveryFee : 0;
      const total = subtotal - discountAmount + fee;

      const order = await tx.order.create({
        data: {
          orderNumber: orderNumber(),
          customerId: req.user.id,
          sellerId,
          status: "new",
          subtotal,
          deliveryFee: fee,
          discountAmount,
          total,
          paymentMethod: data.paymentMethod,
          paymentStatus: "pending",
          deliveryMethod: data.deliveryMethod,
          promoCode: data.promoCode || null,
          recipientName: data.recipientName,
          recipientPhone: normalizePhone(data.recipientPhone),
          region: data.region,
          address: data.address,
          note: data.note || null,
          items: {
            create: lines.map((l) => ({
              productId: l.product.id,
              name: l.product.name,
              image: l.product.image,
              unitPrice: l.product.price,
              quantity: l.quantity,
            })),
          },
        },
        include: orderInclude,
      });

      for (const l of lines) {
        await tx.product.update({
          where: { id: l.product.id },
          data: {
            stock: { decrement: l.quantity },
            ordersCount: { increment: l.quantity },
          },
        });
      }

      await tx.payment.create({
        data: {
          transactionId: txnId("ORD"),
          sellerId,
          orderId: order.id,
          userId: req.user.id,
          type: "sale",
          amount: total,
          method: data.paymentMethod,
          status: "pending",
          description: `Buyurtma ${order.orderNumber}`,
        },
      });

      await tx.notification.create({
        data: {
          userId: req.user.id,
          title: "Buyurtma qabul qilindi",
          message: `${order.orderNumber} buyurtmangiz qabul qilindi`,
          type: "order",
        },
      });

      const seller = await tx.seller.findUnique({ where: { id: sellerId } });
      if (seller) {
        await tx.notification.create({
          data: {
            userId: seller.userId,
            title: "Yangi buyurtma",
            message: `${order.orderNumber} — ${total.toLocaleString("uz-UZ")} so'm`,
            type: "order",
          },
        });
      }

      createdOrders.push(order);
    }

    if (data.fromCart !== false) {
      await tx.cartItem.deleteMany({ where: { userId: req.user.id } });
    }
  });

  return created(res, createdOrders.map(serializeOrder));
});

export const listMyOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = { customerId: req.user.id };
  if (req.query.status) where.status = req.query.status;

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: orderInclude,
    }),
  ]);
  return ok(res, orders.map(serializeOrder), paginationMeta(total, page, limit));
});

export const getMyOrder = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const order = await prisma.order.findFirst({
    where: { id, customerId: req.user.id },
    include: orderInclude,
  });
  if (!order) throw new ApiError(404, "Buyurtma topilmadi");
  return ok(res, serializeOrder(order));
});

export const sellerListOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = { sellerId: req.user.seller.id };
  if (req.query.status) where.status = req.query.status;

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: orderInclude,
    }),
  ]);
  return ok(res, orders.map(serializeOrder), paginationMeta(total, page, limit));
});

export const sellerUpdateOrderStatus = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const schema = z.object({
    status: z.enum(["new", "confirmed", "preparing", "shipping", "delivered", "cancelled"]),
  });
  const { status } = schema.parse(req.body);

  const existing = await prisma.order.findFirst({
    where: { id, sellerId: req.user.seller.id },
  });
  if (!existing) throw new ApiError(404, "Buyurtma topilmadi");

  const order = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id },
      data: {
        status,
        ...(status === "delivered" ? { paymentStatus: "confirmed" } : {}),
      },
      include: orderInclude,
    });

    if (status === "delivered") {
      await tx.payment.updateMany({
        where: { orderId: id },
        data: { status: "confirmed" },
      });
      await tx.seller.update({
        where: { id: existing.sellerId },
        data: { salesTotal: { increment: existing.total } },
      });
    }

    await tx.notification.create({
      data: {
        userId: existing.customerId,
        title: "Buyurtma holati yangilandi",
        message: `${existing.orderNumber} — ${status}`,
        type: "order",
      },
    });

    return updated;
  });

  return ok(res, serializeOrder(order));
});

export const adminListOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.q) {
    where.OR = [
      { orderNumber: { contains: String(req.query.q) } },
      { recipientName: { contains: String(req.query.q) } },
      { recipientPhone: { contains: String(req.query.q) } },
    ];
  }

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: orderInclude,
    }),
  ]);
  return ok(res, orders.map(serializeOrder), paginationMeta(total, page, limit));
});

export const adminGetOrder = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const order = await prisma.order.findUnique({ where: { id }, include: orderInclude });
  if (!order) throw new ApiError(404, "Buyurtma topilmadi");
  return ok(res, serializeOrder(order));
});
