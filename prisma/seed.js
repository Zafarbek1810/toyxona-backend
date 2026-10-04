import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const categories = [
  { name: "Elektronika", icon: "💻", color: "#1A3A6E", bg: "#EEF3FB", sortOrder: 1 },
  { name: "Telefonlar", icon: "📱", color: "#7C3AED", bg: "#F5F3FF", sortOrder: 2 },
  { name: "Maishiy texnika", icon: "🏠", color: "#059669", bg: "#ECFDF5", sortOrder: 3 },
  { name: "Kiyim-kechak", icon: "👗", color: "#DC2626", bg: "#FEF2F2", sortOrder: 4 },
  { name: "Avtomobillar", icon: "🚗", color: "#D97706", bg: "#FFFBEB", sortOrder: 5 },
  { name: "Uy va bog'", icon: "🌿", color: "#065F46", bg: "#ECFDF5", sortOrder: 6 },
  { name: "Sport", icon: "⚽", color: "#0284C7", bg: "#EFF6FF", sortOrder: 7 },
  { name: "Bolalar", icon: "🧸", color: "#DB2777", bg: "#FDF2F8", sortOrder: 8 },
  { name: "Go'zallik", icon: "💄", color: "#9D174D", bg: "#FDF2F8", sortOrder: 9 },
  { name: "Kompyuterlar", icon: "🖥️", color: "#1E40AF", bg: "#EFF6FF", sortOrder: 10 },
  { name: "Xizmatlar", icon: "🔧", color: "#6B7280", bg: "#F9FAFB", sortOrder: 11 },
  { name: "Boshqa", icon: "📦", color: "#374151", bg: "#F3F4F6", sortOrder: 12 },
];

const plans = [
  {
    id: "start",
    name: "START",
    monthlyPrice: 199000,
    yearlyPrice: 1990000,
    color: "#6B7494",
    popular: false,
    features: JSON.stringify([
      "50 ta mahsulot",
      "Asosiy statistika",
      "Standard qo'llab-quvvatlash",
      "Do'kon sahifasi",
      "Chat orqali muloqot",
    ]),
    limits: "50 mahsulot",
    productLimit: 50,
  },
  {
    id: "business",
    name: "BUSINESS",
    monthlyPrice: 499000,
    yearlyPrice: 4990000,
    color: "#1A3A6E",
    popular: true,
    features: JSON.stringify([
      "300 ta mahsulot",
      "Kengaytirilgan statistika",
      "Ustuvor qo'llab-quvvatlash",
      "Reklama imkoniyatlari",
      "Maxsus do'kon dizayni",
      "Ko'proq ko'rinish",
    ]),
    limits: "300 mahsulot",
    productLimit: 300,
  },
  {
    id: "pro",
    name: "PRO",
    monthlyPrice: 999000,
    yearlyPrice: 9990000,
    color: "#D97706",
    popular: false,
    features: JSON.stringify([
      "Cheklovsiz mahsulotlar",
      "Premium analytika",
      "Reklama va promoushan",
      "Bosh sahifada ko'rinish",
      "VIP qo'llab-quvvatlash",
      "API kirish imkoniyati",
      "Ko'p omborxona",
    ]),
    limits: "Cheksiz",
    productLimit: 999999,
  },
];

async function main() {
  console.log("🌱 Seed boshlandi...");

  await prisma.notification.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.review.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.address.deleteMany();
  await prisma.sellerSubscription.deleteMany();
  await prisma.product.deleteMany();
  await prisma.subCategory.deleteMany();
  await prisma.category.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.seller.deleteMany();
  await prisma.user.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.platformSettings.deleteMany();

  for (const plan of plans) {
    await prisma.subscriptionPlan.create({ data: plan });
  }

  await prisma.platformSettings.create({ data: { id: 1 } });

  const catMap = {};
  for (const c of categories) {
    const created = await prisma.category.create({ data: c });
    catMap[c.name] = created.id;
  }

  const passwordHash = await bcrypt.hash("Password123!", 10);

  const admin = await prisma.user.create({
    data: {
      phone: "901111111",
      email: "admin@toyxona.uz",
      passwordHash,
      firstName: "Admin",
      lastName: "To'yxona",
      role: "admin",
      city: "Toshkent shahri",
    },
  });

  const customer1 = await prisma.user.create({
    data: {
      phone: "901234567",
      email: "jasur@example.com",
      passwordHash,
      firstName: "Jasur",
      lastName: "Toshmatov",
      role: "customer",
      city: "Toshkent shahri",
    },
  });

  const customer2 = await prisma.user.create({
    data: {
      phone: "912345678",
      email: "malika@example.com",
      passwordHash,
      firstName: "Malika",
      lastName: "Rahimova",
      role: "customer",
      city: "Samarqand",
    },
  });

  const expires = new Date();
  expires.setMonth(expires.getMonth() + 6);

  const sellersData = [
    {
      phone: "933456789",
      firstName: "TechPlus",
      lastName: "Savdo",
      store: {
        name: "TechPlus Savdo",
        slug: "techplus",
        logo: "https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=80&h=80&fit=crop&auto=format",
        verified: true,
        location: "Toshkent shahri",
        description: "Elektronika va texnologiya mahsulotlarida yetakchi savdo markazi",
        planId: "pro",
        salesTotal: 28400000,
      },
    },
    {
      phone: "974567890",
      firstName: "Zilola",
      lastName: "Moda",
      store: {
        name: "Zilola Moda",
        slug: "zilola-moda",
        logo: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=80&h=80&fit=crop&auto=format",
        verified: true,
        location: "Samarqand",
        description: "Zamonaviy kiyim-kechak va aksessuarlar",
        planId: "business",
        salesTotal: 14200000,
      },
    },
    {
      phone: "935678901",
      firstName: "Hamza",
      lastName: "Electronics",
      store: {
        name: "Hamza Electronics",
        slug: "hamza-electronics",
        logo: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=80&h=80&fit=crop&auto=format",
        verified: true,
        location: "Toshkent shahri",
        description: "Sifatli elektronika mahsulotlari va kafolat bilan",
        planId: "pro",
        salesTotal: 52100000,
      },
    },
    {
      phone: "936789012",
      firstName: "GreenLife",
      lastName: "Market",
      store: {
        name: "GreenLife Market",
        slug: "greenlife",
        logo: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=80&h=80&fit=crop&auto=format",
        verified: false,
        location: "Buxoro",
        description: "Organik mahsulotlar va ekologik tovarlar",
        planId: "start",
        salesTotal: 6800000,
      },
    },
    {
      phone: "937890123",
      firstName: "SportMax",
      lastName: "UZ",
      store: {
        name: "SportMax UZ",
        slug: "sportmax",
        logo: "https://images.unsplash.com/photo-1526068549086-8a75e56000b7?w=80&h=80&fit=crop&auto=format",
        verified: true,
        location: "Andijon",
        description: "Sport jihozlari va kiyimlari ixtisoslashgan do'kon",
        planId: "business",
        salesTotal: 18900000,
      },
    },
  ];

  const sellerRecords = [];
  for (const s of sellersData) {
    const user = await prisma.user.create({
      data: {
        phone: s.phone,
        email: `${s.store.slug}@toyxona.uz`,
        passwordHash,
        firstName: s.firstName,
        lastName: s.lastName,
        role: "seller",
        city: s.store.location,
        seller: {
          create: {
            ...s.store,
            phone: s.phone,
            email: `${s.store.slug}@toyxona.uz`,
            status: "active",
            planExpiresAt: expires,
            billingCycle: "monthly",
          },
        },
      },
      include: { seller: true },
    });
    sellerRecords.push(user.seller);

    await prisma.sellerSubscription.create({
      data: {
        sellerId: user.seller.id,
        planId: s.store.planId,
        billingCycle: "monthly",
        expiresAt: expires,
      },
    });
  }

  const productsSeed = [
    {
      name: "Samsung Galaxy S24 Ultra 12/256GB",
      category: "Telefonlar",
      price: 12500000,
      oldPrice: 14200000,
      discount: 12,
      rating: 4.8,
      reviewCount: 12,
      image: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400&h=400&fit=crop&auto=format",
      sellerIdx: 2,
      location: "Toshkent shahri",
      stock: 24,
      views: 8420,
      ordersCount: 156,
      brand: "Samsung",
      description: "Flagman smartfon — 200MP kamera, S Pen va kuchli performance.",
    },
    {
      name: "MacBook Air M2 8/256GB Space Gray",
      category: "Kompyuterlar",
      price: 18900000,
      oldPrice: 20500000,
      discount: 8,
      rating: 4.9,
      reviewCount: 8,
      image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=400&fit=crop&auto=format",
      sellerIdx: 0,
      location: "Toshkent shahri",
      stock: 8,
      views: 5100,
      ordersCount: 89,
      brand: "Apple",
      description: "Yengil va kuchli MacBook Air M2 chip bilan.",
    },
    {
      name: "Erkaklar uchun klassik kostyum to'plami",
      category: "Kiyim-kechak",
      price: 1850000,
      oldPrice: 2200000,
      discount: 16,
      rating: 4.6,
      reviewCount: 5,
      image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=400&fit=crop&auto=format",
      sellerIdx: 1,
      location: "Samarqand",
      stock: 45,
      views: 3200,
      ordersCount: 67,
      brand: "Zilola",
      description: "Rasmiy tadbirlar uchun klassik kostyum to'plami.",
    },
    {
      name: "Sony WH-1000XM5 Simsiz quloqchin",
      category: "Elektronika",
      price: 3200000,
      oldPrice: 3800000,
      discount: 16,
      rating: 4.7,
      reviewCount: 15,
      image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop&auto=format",
      sellerIdx: 2,
      location: "Toshkent shahri",
      stock: 15,
      views: 6800,
      ordersCount: 112,
      brand: "Sony",
      description: "Premium noise-cancelling simsiz quloqchin.",
    },
    {
      name: "Nike Air Max 270 Krossovkalar",
      category: "Sport",
      price: 980000,
      oldPrice: 1200000,
      discount: 18,
      rating: 4.5,
      reviewCount: 9,
      image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop&auto=format",
      sellerIdx: 4,
      location: "Andijon",
      stock: 32,
      views: 4500,
      ordersCount: 78,
      brand: "Nike",
      description: "Qulay va zamonaviy sport krossovkalari.",
    },
    {
      name: "Xiaomi Robot Vacuum Cleaner S10+",
      category: "Maishiy texnika",
      price: 4500000,
      oldPrice: 5200000,
      discount: 13,
      rating: 4.8,
      reviewCount: 6,
      image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop&auto=format",
      sellerIdx: 0,
      location: "Toshkent shahri",
      stock: 6,
      views: 2900,
      ordersCount: 43,
      brand: "Xiaomi",
      description: "Aqlli robot changyutgich, mapping va app boshqaruvi.",
    },
    {
      name: 'iPad Pro 12.9" M2 256GB WiFi',
      category: "Elektronika",
      price: 16800000,
      oldPrice: 18500000,
      discount: 9,
      rating: 4.9,
      reviewCount: 7,
      image: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400&h=400&fit=crop&auto=format",
      sellerIdx: 2,
      location: "Toshkent shahri",
      stock: 12,
      views: 7200,
      ordersCount: 94,
      brand: "Apple",
      description: "Professional planshet Liquid Retina XDR ekran bilan.",
    },
    {
      name: "Ayollar uchun qish palto",
      category: "Kiyim-kechak",
      price: 1250000,
      oldPrice: 1600000,
      discount: 22,
      rating: 4.4,
      reviewCount: 4,
      image: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&h=400&fit=crop&auto=format",
      sellerIdx: 1,
      location: "Samarqand",
      stock: 28,
      views: 1800,
      ordersCount: 31,
      brand: "Zilola",
      description: "Issiq va zamonaviy qishki palto.",
    },
  ];

  const products = [];
  for (const p of productsSeed) {
    const created = await prisma.product.create({
      data: {
        sellerId: sellerRecords[p.sellerIdx].id,
        categoryId: catMap[p.category],
        name: p.name,
        brand: p.brand,
        description: p.description,
        price: p.price,
        oldPrice: p.oldPrice,
        discount: p.discount,
        stock: p.stock,
        image: p.image,
        images: JSON.stringify([p.image]),
        specs: JSON.stringify({ Brand: p.brand, Kafolat: "12 oy" }),
        status: "active",
        moderationStatus: "approved",
        location: p.location,
        rating: p.rating,
        reviewCount: p.reviewCount,
        views: p.views,
        ordersCount: p.ordersCount,
      },
    });
    products.push(created);
  }

  await prisma.address.createMany({
    data: [
      {
        userId: customer1.id,
        title: "Uy",
        fullName: "Jasur Toshmatov",
        phone: "901234567",
        region: "Toshkent shahri",
        address: "Chilonzor tumani, 12-mavze, 45-uy",
        isDefault: true,
      },
      {
        userId: customer1.id,
        title: "Ish",
        fullName: "Jasur Toshmatov",
        phone: "901234567",
        region: "Toshkent shahri",
        address: "Yunusobod tumani, 19-mavze, 8-uy",
        isDefault: false,
      },
    ],
  });

  await prisma.cartItem.createMany({
    data: [
      { userId: customer1.id, productId: products[0].id, quantity: 1 },
      { userId: customer1.id, productId: products[2].id, quantity: 1 },
    ],
  });

  await prisma.favorite.create({
    data: { userId: customer1.id, productId: products[1].id },
  });

  const orderDefs = [
    {
      product: products[0],
      seller: sellerRecords[2],
      status: "delivered",
      paymentMethod: "payme",
      address: "Chilonzor tumani, 12-mavze, 45-uy",
      daysAgo: 10,
    },
    {
      product: products[3],
      seller: sellerRecords[2],
      status: "shipping",
      paymentMethod: "click",
      address: "Yunusobod tumani, 19-mavze, 8-uy",
      daysAgo: 5,
    },
    {
      product: products[1],
      seller: sellerRecords[0],
      status: "preparing",
      paymentMethod: "uzum",
      address: "Mirzo Ulug'bek tumani, 5-mavze, 22-uy",
      daysAgo: 3,
    },
    {
      product: products[4],
      seller: sellerRecords[4],
      status: "confirmed",
      paymentMethod: "payme",
      address: "Shayxontohur tumani, 3-mavze, 17-uy",
      daysAgo: 2,
    },
    {
      product: products[2],
      seller: sellerRecords[1],
      status: "cancelled",
      paymentMethod: "card",
      address: "Sergeli tumani, 8-mavze, 31-uy",
      daysAgo: 20,
    },
  ];

  for (let i = 0; i < orderDefs.length; i++) {
    const o = orderDefs[i];
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - o.daysAgo);
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-2024-${String(1842 - i * 80).padStart(6, "0")}`,
        customerId: customer1.id,
        sellerId: o.seller.id,
        status: o.status,
        subtotal: o.product.price,
        deliveryFee: 25000,
        discountAmount: 0,
        total: o.product.price + 25000,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.status === "delivered" ? "confirmed" : o.status === "cancelled" ? "refunded" : "pending",
        deliveryMethod: "standard",
        recipientName: "Jasur Toshmatov",
        recipientPhone: "901234567",
        region: "Toshkent shahri",
        address: o.address,
        reviewed: o.status === "delivered",
        createdAt,
        items: {
          create: [
            {
              productId: o.product.id,
              name: o.product.name,
              image: o.product.image,
              unitPrice: o.product.price,
              quantity: 1,
            },
          ],
        },
      },
    });

    await prisma.payment.create({
      data: {
        transactionId: `#TXN-SEED-${i + 1}`,
        sellerId: o.seller.id,
        orderId: order.id,
        userId: customer1.id,
        type: "sale",
        amount: order.total,
        method: o.paymentMethod,
        status: order.paymentStatus,
        description: `Buyurtma ${order.orderNumber}`,
        createdAt,
      },
    });

    if (o.status === "delivered") {
      await prisma.review.create({
        data: {
          productId: o.product.id,
          sellerId: o.seller.id,
          userId: customer1.id,
          orderId: order.id,
          rating: 5,
          comment: "Juda yaxshi mahsulot, tez yetkazib berishdi!",
          verifiedPurchase: true,
          createdAt,
        },
      });
    }
  }

  await prisma.promotion.createMany({
    data: [
      {
        title: "Bahorgi chegirmalar",
        type: "banner",
        status: "active",
        description: "Tanlangan mahsulotlarga 20% gacha chegirma",
        promoCode: "BAHOR20",
        discountPct: 20,
        link: "/products?onSale=true",
        startDate: new Date(Date.now() - 7 * 86400000),
        endDate: new Date(Date.now() + 30 * 86400000),
        clicks: 1200,
        conversions: 84,
      },
      {
        title: "Flash Sale",
        type: "flash",
        status: "active",
        description: "48 soatlik maxsus narxlar",
        promoCode: "FLASH15",
        discountPct: 15,
        startDate: new Date(Date.now() - 1 * 86400000),
        endDate: new Date(Date.now() + 2 * 86400000),
        clicks: 540,
        conversions: 41,
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: customer1.id,
        title: "Buyurtma yetkazildi",
        message: "ORD-2024-001842 buyurtmangiz yetkazildi",
        type: "order",
        read: false,
      },
      {
        userId: customer1.id,
        title: "Bahorgi aksiya",
        message: "BAHOR20 kodi bilan 20% chegirma oling",
        type: "promo",
        read: false,
      },
      {
        userId: sellerRecords[0].userId,
        title: "Yangi buyurtma",
        message: "Sizda yangi buyurtma bor",
        type: "order",
        read: false,
      },
    ],
  });

  console.log("✅ Seed yakunlandi");
  console.log("\nDemo hisoblar (parol: Password123!):");
  console.log("  Admin:     901111111 / admin@toyxona.uz");
  console.log("  Xaridor:   901234567");
  console.log("  Sotuvchi:  933456789 (TechPlus)");
  console.log(`  Admin ID: ${admin.id}, Customer2: ${customer2.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
