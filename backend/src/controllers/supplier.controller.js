const prisma = require("../lib/prisma");

/**
 * Creates a new supplier for the authenticated user.
 */
const createSupplier = async (req, res, next) => {
  try {
    const { name, phone, email, address, category, notes, active } = req.body;

    const supplier = await prisma.supplier.create({
      data: {
        userId: req.user.id,
        name: name.trim(),
        phone: phone ? phone.trim() : null,
        email: email && email.trim() ? email.trim().toLowerCase() : null,
        address: address ? address.trim() : null,
        category: category ? category.trim() : null,
        notes: notes ? notes.trim() : null,
        active: active !== undefined ? Boolean(active) : true,
      },
    });

    res.status(201).json({
      success: true,
      message: "Supplier created successfully",
      data: supplier,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves all suppliers belonging to the authenticated user.
 * Supports searching by name/phone/category and computes payables for each supplier.
 */
const getSuppliers = async (req, res, next) => {
  try {
    const { search, active, category } = req.query;
    const userId = req.user.id;

    const where = { userId };

    if (active !== undefined && active !== "") {
      where.active = active === "true";
    }

    if (category && category.trim()) {
      where.category = category.trim();
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
      ];
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        expenses: {
          select: {
            id: true,
            amount: true,
            amountPaid: true,
            amountDue: true,
            paymentStatus: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const enriched = suppliers.map((s) => {
      const totalPurchases = s.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
      const totalPaid = s.expenses.reduce((sum, e) => sum + Number(e.amountPaid || 0), 0);
      const outstandingPayables = s.expenses.reduce((sum, e) => sum + Number(e.amountDue || 0), 0);

      const { expenses, ...supplierData } = s;
      return {
        ...supplierData,
        totalPurchases,
        totalPaid,
        outstandingPayables,
        expensesCount: expenses.length,
      };
    });

    res.json({
      success: true,
      data: enriched,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves a single supplier profile with financial totals and recent purchases.
 */
const getSupplierById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const supplier = await prisma.supplier.findFirst({
      where: {
        id: Number(id),
        userId,
      },
      include: {
        expenses: {
          include: {
            house: { select: { id: true, name: true } },
            breed: { select: { id: true, name: true } },
          },
          orderBy: { date: "desc" },
        },
      },
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    const totalPurchases = supplier.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalPaid = supplier.expenses.reduce((sum, e) => sum + Number(e.amountPaid || 0), 0);
    const outstandingPayables = supplier.expenses.reduce((sum, e) => sum + Number(e.amountDue || 0), 0);

    res.json({
      success: true,
      data: {
        ...supplier,
        totalPurchases,
        totalPaid,
        outstandingPayables,
        expenses: supplier.expenses.map((e) => ({
          ...e,
          amount: Number(e.amount),
          amountPaid: Number(e.amountPaid || 0),
          amountDue: Number(e.amountDue || 0),
          quantity: e.quantity ? Number(e.quantity) : null,
          unitPrice: e.unitPrice ? Number(e.unitPrice) : null,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates an existing supplier record.
 */
const updateSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address, category, notes, active } = req.body;
    const userId = req.user.id;

    const existing = await prisma.supplier.findFirst({
      where: {
        id: Number(id),
        userId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    const updated = await prisma.supplier.update({
      where: { id: Number(id) },
      data: {
        name: name !== undefined ? name.trim() : existing.name,
        phone: phone !== undefined ? (phone ? phone.trim() : null) : existing.phone,
        email: email !== undefined ? (email && email.trim() ? email.trim().toLowerCase() : null) : existing.email,
        address: address !== undefined ? (address ? address.trim() : null) : existing.address,
        category: category !== undefined ? (category ? category.trim() : null) : existing.category,
        notes: notes !== undefined ? (notes ? notes.trim() : null) : existing.notes,
        active: active !== undefined ? Boolean(active) : existing.active,
      },
    });

    res.json({
      success: true,
      message: "Supplier updated successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deletes an existing supplier record.
 */
const deleteSupplier = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const existing = await prisma.supplier.findFirst({
      where: {
        id: Number(id),
        userId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    await prisma.supplier.delete({
      where: { id: Number(id) },
    });

    res.json({
      success: true,
      message: "Supplier deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSupplier,
  getSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
};
