import { z } from "zod";
import { prisma } from "../config/db.js";
import {
  ApiError,
  asyncHandler,
  created,
  normalizePhone,
  ok,
} from "../utils/helpers.js";

function serializeAddress(a) {
  return {
    id: a.id,
    title: a.title,
    fullName: a.fullName,
    phone: a.phone,
    region: a.region,
    address: a.address,
    isDefault: a.isDefault,
    createdAt: a.createdAt,
  };
}

export const listAddresses = asyncHandler(async (req, res) => {
  const items = await prisma.address.findMany({
    where: { userId: req.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return ok(res, items.map(serializeAddress));
});

export const createAddress = asyncHandler(async (req, res) => {
  const schema = z.object({
    title: z.string().min(1),
    fullName: z.string().min(1),
    phone: z.string().min(9),
    region: z.string().min(1),
    address: z.string().min(3),
    isDefault: z.boolean().optional(),
  });
  const data = schema.parse(req.body);
  data.phone = normalizePhone(data.phone);

  if (data.isDefault) {
    await prisma.address.updateMany({
      where: { userId: req.user.id },
      data: { isDefault: false },
    });
  }

  const count = await prisma.address.count({ where: { userId: req.user.id } });
  const address = await prisma.address.create({
    data: {
      ...data,
      userId: req.user.id,
      isDefault: data.isDefault ?? count === 0,
    },
  });
  return created(res, serializeAddress(address));
});

export const updateAddress = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.address.findFirst({ where: { id, userId: req.user.id } });
  if (!existing) throw new ApiError(404, "Manzil topilmadi");

  const schema = z.object({
    title: z.string().min(1).optional(),
    fullName: z.string().min(1).optional(),
    phone: z.string().min(9).optional(),
    region: z.string().min(1).optional(),
    address: z.string().min(3).optional(),
    isDefault: z.boolean().optional(),
  });
  const data = schema.parse(req.body);
  if (data.phone) data.phone = normalizePhone(data.phone);

  if (data.isDefault) {
    await prisma.address.updateMany({
      where: { userId: req.user.id },
      data: { isDefault: false },
    });
  }

  const address = await prisma.address.update({ where: { id }, data });
  return ok(res, serializeAddress(address));
});

export const deleteAddress = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.address.findFirst({ where: { id, userId: req.user.id } });
  if (!existing) throw new ApiError(404, "Manzil topilmadi");
  await prisma.address.delete({ where: { id } });
  return ok(res, { message: "Manzil o'chirildi" });
});

export const setDefaultAddress = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.address.findFirst({ where: { id, userId: req.user.id } });
  if (!existing) throw new ApiError(404, "Manzil topilmadi");

  await prisma.address.updateMany({
    where: { userId: req.user.id },
    data: { isDefault: false },
  });
  const address = await prisma.address.update({
    where: { id },
    data: { isDefault: true },
  });
  return ok(res, serializeAddress(address));
});
