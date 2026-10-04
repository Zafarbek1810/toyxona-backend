export class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function ok(res, data = null, meta = undefined, status = 200) {
  const body = { success: true, data };
  if (meta !== undefined) body.meta = meta;
  return res.status(status).json(body);
}

export function created(res, data) {
  return ok(res, data, undefined, 201);
}

/** Keep only digits; strip leading 998 country code when present. */
export function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("998") && digits.length >= 12) {
    return digits.slice(3);
  }
  return digits;
}

export function isValidUzPhone(phone) {
  return /^[0-9]{9}$/.test(phone);
}

export function slugify(text) {
  return (
    String(text || "")
      .toLowerCase()
      .trim()
      .replace(/[''`]/g, "")
      .replace(/[^a-z0-9\u0400-\u04FF]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || `store-${Date.now()}`
  );
}

export function parseJson(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function toJson(value) {
  return JSON.stringify(value ?? null);
}

export function paginate(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function paginationMeta(total, page, limit) {
  return {
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

export function orderNumber() {
  const y = new Date().getFullYear();
  const n = Math.floor(100000 + Math.random() * 900000);
  return `ORD-${y}-${n}`;
}

export function txnId(prefix = "TXN") {
  return `#${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 9999)}`;
}

export const REGIONS = [
  "Toshkent shahri",
  "Toshkent viloyati",
  "Samarqand",
  "Buxoro",
  "Andijon",
  "Farg'ona",
  "Namangan",
  "Qashqadaryo",
  "Surxondaryo",
  "Xorazm",
  "Navoiy",
  "Jizzax",
  "Sirdaryo",
  "Qoraqalpog'iston",
];

export const ORDER_STATUS_UZ = {
  new: "Yangi",
  confirmed: "Tasdiqlangan",
  preparing: "Tayyorlanmoqda",
  shipping: "Yetkazilmoqda",
  delivered: "Yetkazildi",
  cancelled: "Bekor qilindi",
};

export const PRODUCT_STATUS_UZ = {
  draft: "Qoralama",
  active: "Faol",
  inactive: "Faol emas",
  archived: "Arxiv",
};
