import { parseJson, ORDER_STATUS_UZ, PRODUCT_STATUS_UZ } from "./helpers.js";
import { publicUrl } from "../middleware/upload.js";

export function serializeUser(user, { includeSeller = true } = {}) {
  if (!user) return null;
  const base = {
    id: user.id,
    phone: user.phone,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    name: `${user.firstName} ${user.lastName}`.trim(),
    role: user.role,
    birthDate: user.birthDate,
    city: user.city,
    active: user.active,
    language: user.language,
    currency: user.currency,
    settings: {
      orderUpdates: user.orderUpdates,
      promoEmails: user.promoEmails,
      smsAlerts: user.smsAlerts,
      language: user.language,
      currency: user.currency,
    },
    createdAt: user.createdAt,
  };
  if (includeSeller && user.seller) base.seller = serializeSeller(user.seller);
  return base;
}

export function serializeSeller(seller, { includeUser = false } = {}) {
  if (!seller) return null;
  const daysLeft = seller.planExpiresAt
    ? Math.max(0, Math.ceil((new Date(seller.planExpiresAt) - new Date()) / 86400000))
    : null;
  return {
    id: seller.id,
    userId: seller.userId,
    name: seller.name,
    firstName: seller.user?.firstName ?? seller.firstName ?? null,
    lastName: seller.user?.lastName ?? seller.lastName ?? null,
    slug: seller.slug,
    logo: publicUrl(seller.logo) || seller.logo,
    description: seller.description,
    verified: seller.verified,
    location: seller.location,
    phone: seller.phone,
    email: seller.email,
    businessType: seller.businessType,
    workingHours: seller.workingHours,
    status: seller.status,
    subscription: String(seller.planId || "start").toUpperCase(),
    planId: seller.planId,
    billingCycle: seller.billingCycle,
    planExpiresAt: seller.planExpiresAt,
    daysLeft,
    sales: seller.salesTotal,
    salesTotal: seller.salesTotal,
    followersCount: seller.followersCount,
    productCount: seller._count?.products ?? seller.productCount ?? undefined,
    rating: seller.rating ?? undefined,
    reviewCount: seller.reviewCount ?? undefined,
    ordersCount: seller._count?.orders ?? seller.ordersCount ?? undefined,
    joined: seller.createdAt,
    createdAt: seller.createdAt,
    delivery: {
      minOrderAmount: seller.minOrderAmount,
      deliveryTimeframe: seller.deliveryTimeframe,
      freeDeliveryThreshold: seller.freeDeliveryThreshold,
    },
    notifications: {
      newOrder: seller.notifyNewOrder,
      newReview: seller.notifyNewReview,
      lowStock: seller.notifyLowStock,
      paymentConfirmed: seller.notifyPayment,
    },
    ...(includeUser && seller.user ? { user: serializeUser(seller.user, { includeSeller: false }) } : {}),
  };
}

export function serializeProduct(product) {
  if (!product) return null;
  const images = parseJson(product.images, []).map((img) => publicUrl(img) || img);
  const image = publicUrl(product.image) || product.image || images[0] || null;
  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    description: product.description,
    categoryId: product.categoryId,
    category: product.category?.name || product.category,
    subCategoryId: product.subCategoryId,
    subCategory: product.subCategory?.name,
    price: product.price,
    oldPrice: product.oldPrice,
    discount: product.discount,
    stock: product.stock,
    sku: product.sku,
    image,
    images,
    specs: parseJson(product.specs, {}),
    status: product.status,
    statusLabel: PRODUCT_STATUS_UZ[product.status] || product.status,
    moderationStatus: product.moderationStatus,
    location: product.location,
    rating: product.rating,
    reviewCount: product.reviewCount,
    views: product.views,
    orders: product.ordersCount,
    sellerId: product.sellerId,
    seller: product.seller ? serializeSeller(product.seller) : undefined,
    createdAt: product.createdAt,
  };
}

function iconUrl(icon) {
  if (!icon) return icon ?? null;
  const value = String(icon);
  const isFile =
    value.startsWith("http") ||
    value.startsWith("/") ||
    value.startsWith("data:") ||
    /\.(png|jpe?g|webp|svg|gif)$/i.test(value);
  if (!isFile) return value;
  return publicUrl(value) || value;
}

export function serializeSubcategory(sub) {
  return {
    id: sub.id,
    name: sub.name,
    icon: iconUrl(sub.icon),
    active: sub.active,
    count: sub._count?.products ?? sub.count ?? 0,
  };
}

export function serializeCategory(cat) {
  return {
    id: cat.id,
    name: cat.name,
    icon: iconUrl(cat.icon),
    color: cat.color,
    bg: cat.bg,
    active: cat.active,
    sortOrder: cat.sortOrder,
    count: cat._count?.products ?? cat.count ?? 0,
    subcategories: (cat.subcategories || []).map(serializeSubcategory),
  };
}

export function serializeOrder(order) {
  if (!order) return null;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    statusLabel: ORDER_STATUS_UZ[order.status] || order.status,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    discountAmount: order.discountAmount,
    total: order.total,
    price: order.total,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    deliveryMethod: order.deliveryMethod,
    promoCode: order.promoCode,
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    region: order.region,
    address: order.address,
    note: order.note,
    reviewed: order.reviewed,
    date: order.createdAt,
    createdAt: order.createdAt,
    customer: order.customer
      ? {
          id: order.customer.id,
          name: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
          phone: order.customer.phone,
          email: order.customer.email,
        }
      : undefined,
    seller: order.seller ? serializeSeller(order.seller) : undefined,
    items: (order.items || []).map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.name,
      image: publicUrl(item.image) || item.image,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      product: item.product ? serializeProduct(item.product) : undefined,
    })),
    product: order.items?.[0]
      ? {
          id: order.items[0].productId,
          name: order.items[0].name,
          image: publicUrl(order.items[0].image) || order.items[0].image,
          price: order.items[0].unitPrice,
        }
      : undefined,
  };
}

export function serializeReview(review) {
  return {
    id: review.id,
    productId: review.productId,
    sellerId: review.sellerId,
    orderId: review.orderId,
    rating: review.rating,
    comment: review.comment,
    text: review.comment,
    verifiedPurchase: review.verifiedPurchase,
    sellerReply: review.sellerReply,
    replied: Boolean(review.sellerReply),
    repliedAt: review.repliedAt,
    date: review.createdAt,
    createdAt: review.createdAt,
    authorName: review.user
      ? `${review.user.firstName} ${review.user.lastName}`.trim()
      : undefined,
    user: review.user
      ? { id: review.user.id, firstName: review.user.firstName, lastName: review.user.lastName }
      : undefined,
    product: review.product ? serializeProduct(review.product) : undefined,
  };
}

export function serializePayment(p) {
  return {
    id: p.id,
    transactionId: p.transactionId,
    sellerId: p.sellerId,
    orderId: p.orderId,
    type: p.type,
    amount: p.amount,
    method: p.method,
    status: p.status,
    description: p.description,
    date: p.createdAt,
    createdAt: p.createdAt,
  };
}

export function serializePromotion(p) {
  return {
    id: p.id,
    title: p.title,
    type: p.type,
    status: p.status,
    description: p.description,
    link: p.link,
    image: publicUrl(p.image) || p.image,
    promoCode: p.promoCode,
    discountPct: p.discountPct,
    startDate: p.startDate,
    endDate: p.endDate,
    clicks: p.clicks,
    conversions: p.conversions,
    conversion: p.clicks ? Math.round((p.conversions / p.clicks) * 1000) / 10 : 0,
  };
}

export function serializeNotification(n) {
  return {
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    read: n.read,
    createdAt: n.createdAt,
    time: n.createdAt,
  };
}

export function serializePlan(plan) {
  return {
    id: plan.id,
    name: plan.name,
    monthlyPrice: plan.monthlyPrice,
    yearlyPrice: plan.yearlyPrice,
    color: plan.color,
    popular: plan.popular,
    features: parseJson(plan.features, []),
    limits: plan.limits,
    productLimit: plan.productLimit,
    active: plan.active,
    subscribers: plan._count?.subscriptions ?? plan.subscribers ?? 0,
  };
}
