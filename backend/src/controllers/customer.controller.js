const prisma = require("../lib/prisma");

/**
 * Creates a new customer for the authenticated user.
 */
const createCustomer = async (req, res, next) => {
  try {
    const { name, phone, email, address, notes, active } = req.body;

    const customer = await prisma.customer.create({
      data: {
        userId: req.user.id,
        name: name.trim(),
        phone: phone ? phone.trim() : null,
        email: email && email.trim() ? email.trim().toLowerCase() : null,
        address: address ? address.trim() : null,
        notes: notes ? notes.trim() : null,
        active: active !== undefined ? Boolean(active) : true,
      },
    });

    res.status(201).json({
      success: true,
      message: "Customer created successfully",
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves all customers belonging to the authenticated user.
 * Supports searching by name/phone and computes financial stats for each customer.
 */
const getCustomers = async (req, res, next) => {
  try {
    const { search, active } = req.query;
    const userId = req.user.id;

    const where = { userId };

    if (active !== undefined && active !== "") {
      where.active = active === "true";
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        sales: {
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

    const enriched = customers.map((c) => {
      const totalPurchases = c.sales.reduce((sum, s) => sum + Number(s.amount), 0);
      const totalPaid = c.sales.reduce((sum, s) => sum + Number(s.amountPaid || 0), 0);
      const outstandingBalance = c.sales.reduce((sum, s) => sum + Number(s.amountDue || 0), 0);

      const { sales, ...customerData } = c;
      return {
        ...customerData,
        totalPurchases,
        totalPaid,
        outstandingBalance,
        salesCount: sales.length,
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
 * Retrieves a single customer profile with financial totals and recent sales.
 */
const getCustomerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const customer = await prisma.customer.findFirst({
      where: {
        id: Number(id),
        userId,
      },
      include: {
        sales: {
          include: {
            house: { select: { id: true, name: true } },
            breed: { select: { id: true, name: true } },
          },
          orderBy: { date: "desc" },
        },
      },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    const totalPurchases = customer.sales.reduce((sum, s) => sum + Number(s.amount), 0);
    const totalPaid = customer.sales.reduce((sum, s) => sum + Number(s.amountPaid || 0), 0);
    const outstandingBalance = customer.sales.reduce((sum, s) => sum + Number(s.amountDue || 0), 0);

    res.json({
      success: true,
      data: {
        ...customer,
        totalPurchases,
        totalPaid,
        outstandingBalance,
        sales: customer.sales.map((s) => ({
          ...s,
          amount: Number(s.amount),
          amountPaid: Number(s.amountPaid || 0),
          amountDue: Number(s.amountDue || 0),
          quantity: s.quantity ? Number(s.quantity) : null,
          unitPrice: s.unitPrice ? Number(s.unitPrice) : null,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates an existing customer record.
 */
const updateCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address, notes, active } = req.body;
    const userId = req.user.id;

    const existing = await prisma.customer.findFirst({
      where: {
        id: Number(id),
        userId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    const updated = await prisma.customer.update({
      where: { id: Number(id) },
      data: {
        name: name !== undefined ? name.trim() : existing.name,
        phone: phone !== undefined ? (phone ? phone.trim() : null) : existing.phone,
        email: email !== undefined ? (email && email.trim() ? email.trim().toLowerCase() : null) : existing.email,
        address: address !== undefined ? (address ? address.trim() : null) : existing.address,
        notes: notes !== undefined ? (notes ? notes.trim() : null) : existing.notes,
        active: active !== undefined ? Boolean(active) : existing.active,
      },
    });

    res.json({
      success: true,
      message: "Customer updated successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deletes an existing customer record.
 */
const deleteCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const existing = await prisma.customer.findFirst({
      where: {
        id: Number(id),
        userId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    await prisma.customer.delete({
      where: { id: Number(id) },
    });

    res.json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
};
