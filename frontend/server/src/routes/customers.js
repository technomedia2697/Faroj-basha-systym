import express from 'express';
import mongoose from 'mongoose';
import Customer from '../models/Customer.js';
import Order from '../models/Order.js';
import { verifyToken } from '../middleware/auth.js';
import { requirePermission, requireRole } from '../middleware/permissions.js';
import { sendRouteError } from '../middleware/routeError.js';
import { getFormattedPhonePattern, normalizePhone } from '../utils/phone.js';

const router = express.Router();
const customerFields = ['name', 'phone', 'address', 'notes', 'nextFollowUp'];

function validateCustomer(body, { importing = false } = {}) {
  if (
    typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 120 ||
    typeof body.phone !== 'string' || body.phone.trim().length > 40 ||
    typeof body.address !== 'string' || body.address.length > 500 ||
    typeof body.notes !== 'string' || body.notes.length > 1000 ||
    typeof body.nextFollowUp !== 'string' || body.nextFollowUp.length > 30
  ) {
    return { error: 'بيانات العميل غير صحيحة' };
  }
  const normalizedPhone = normalizePhone(body.phone);
  if (!normalizedPhone) return { error: 'رقم هاتف صالح مطلوب' };

  const loyaltyPoints = importing ? Number(body.loyaltyPoints || 0) : 0;
  if (!Number.isSafeInteger(loyaltyPoints) || loyaltyPoints < 0 || loyaltyPoints > 1000000) {
    return { error: 'رصيد نقاط الولاء غير صحيح' };
  }

  return {
    value: {
      name: body.name.trim(),
      phone: body.phone.trim(),
      normalizedPhone,
      address: body.address.trim(),
      notes: body.notes.trim(),
      nextFollowUp: body.nextFollowUp.trim(),
      loyaltyPoints,
    },
  };
}

router.get('/', verifyToken, requirePermission('view_customers'), async (req, res) => {
  try {
    const customers = await Customer.find().sort({ name: 1, _id: 1 }).lean();
    if (customers.length === 0) return res.json([]);

    const phoneFilters = customers.flatMap((customer) => {
      const formattedPhonePattern = getFormattedPhonePattern(customer.phone);
      return [
        { customer_phone_normalized: customer.normalizedPhone },
        ...(formattedPhonePattern ? [{ customer_phone: formattedPhonePattern }] : []),
      ];
    });
    const orders = await Order.find({
      $or: [
        { customerId: { $in: customers.map((customer) => customer._id) } },
        ...phoneFilters,
      ],
    })
      .select('customerId customer_phone customer_phone_normalized total')
      .lean();

    const customerById = new Map(customers.map((customer) => [String(customer._id), customer]));
    const statsByPhone = new Map(customers.map((customer) => [
      customer.normalizedPhone,
      { orderCount: 0, totalSpent: 0 },
    ]));
    for (const order of orders) {
      const linkedCustomer = order.customerId && customerById.get(String(order.customerId));
      const normalizedPhone = linkedCustomer?.normalizedPhone
        || normalizePhone(order.customer_phone_normalized || order.customer_phone);
      const stats = statsByPhone.get(normalizedPhone);
      if (!stats) continue;
      stats.orderCount += 1;
      stats.totalSpent += Number(order.total) || 0;
    }

    res.json(customers.map((customer) => {
      const stats = statsByPhone.get(customer.normalizedPhone);
      return {
        ...customer,
        orderCount: Math.max(Number(customer.orderCount) || 0, stats.orderCount),
        loyaltyPoints: Math.max(Number(customer.loyaltyPoints) || 0, stats.orderCount),
        totalSpent: Math.max(Number(customer.totalSpent) || 0, stats.totalSpent),
      };
    }));
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.post('/', verifyToken, requirePermission('create_customers'), async (req, res) => {
  const validation = validateCustomer(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });

  try {
    const customer = await Customer.create(validation.value);
    res.status(201).json(customer);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'رقم الهاتف مسجل بالفعل لدى عميل آخر' });
    sendRouteError(res, error);
  }
});

router.post('/import', verifyToken, requireRole('admin'), async (req, res) => {
  if (!Array.isArray(req.body.customers) || req.body.customers.length > 500) {
    return res.status(400).json({ error: 'قائمة العملاء غير صحيحة أو تتجاوز الحد المسموح' });
  }

  const byPhone = new Map();
  for (const rawCustomer of req.body.customers) {
    const validation = validateCustomer(rawCustomer, { importing: true });
    if (validation.error) return res.status(400).json({ error: validation.error });
    byPhone.set(validation.value.normalizedPhone, validation.value);
  }

  try {
    const customers = [...byPhone.values()];
    if (customers.length === 0) return res.json({ imported: 0 });

    const result = await Customer.bulkWrite(customers.map((customer) => ({
      updateOne: {
        filter: { normalizedPhone: customer.normalizedPhone },
        update: { $setOnInsert: customer },
        upsert: true,
      },
    })), { ordered: true });

    res.json({ imported: result.upsertedCount || 0 });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'رقم هاتف مكرر ضمن بيانات العملاء' });
    sendRouteError(res, error);
  }
});

router.put('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'معرف العميل غير صحيح' });
  const validation = validateCustomer(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });

  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'العميل غير موجود' });

    customerFields.forEach((field) => { customer[field] = validation.value[field]; });
    customer.normalizedPhone = validation.value.normalizedPhone;
    await customer.save();
    res.json(customer);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'رقم الهاتف مسجل بالفعل لدى عميل آخر' });
    sendRouteError(res, error);
  }
});

router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'معرف العميل غير صحيح' });

  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) return res.status(404).json({ error: 'العميل غير موجود' });
    res.json({ message: 'تم حذف العميل' });
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.get('/:id/orders', verifyToken, requirePermission('view_customers'), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'معرف العميل غير صحيح' });
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));

  try {
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) return res.status(404).json({ error: 'العميل غير موجود' });

    const filter = {
      $or: [
        { customerId: customer._id },
        { customer_phone_normalized: customer.normalizedPhone },
        { customer_phone: customer.phone },
        { customer_phone: { $regex: getFormattedPhonePattern(customer.phone) } },
      ],
    };
    const [orders, total, totals] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
      Order.aggregate([
        { $match: filter },
        { $group: { _id: null, totalSpent: { $sum: '$total' } } },
      ]),
    ]);

    res.json({
      orders,
      page,
      limit,
      total,
      totalSpent: Number(totals[0]?.totalSpent || 0),
      hasMore: page * limit < total,
    });
  } catch (error) {
    sendRouteError(res, error);
  }
});

export default router;
