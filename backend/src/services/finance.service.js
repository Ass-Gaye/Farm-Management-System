const prisma = require("../lib/prisma");

/**
 * Finance domain service (extracted from finance.controller.js).
 * Controllers should import from here; the controller re-exports these
 * for backward compatibility.
 */

const validateOwnership = async (userId, houseId, breedId, customerId, supplierId, feedTypeId, flockId) => {
  const uid = Number(userId);

  if (houseId) {
    const house = await prisma.poultryHouse.findFirst({
      where: { id: Number(houseId), userId: uid },
    });
    if (!house) {
      return { valid: false, status: 404, error: "Poultry house not found or does not belong to your farm" };
    }
  }

  if (flockId) {
    const flock = await prisma.flock.findFirst({
      where: {
        id: Number(flockId),
        userId: uid,
        ...(houseId ? { houseId: Number(houseId) } : {}),
      },
    });
    if (!flock) {
      return { valid: false, status: 404, error: "Flock batch not found or does not belong to your poultry house" };
    }
  }

  if (breedId) {
    const breed = await prisma.breed.findFirst({
      where: {
        id: Number(breedId),
        house: { userId: uid, ...(houseId ? { id: Number(houseId) } : {}) },
      },
    });
    if (!breed) {
      return { valid: false, status: 404, error: "Flock/breed record not found or does not belong to your poultry house" };
    }
  }

  if (customerId) {
    const customer = await prisma.customer.findFirst({ where: { id: Number(customerId), userId: uid } });
    if (!customer) {
      return { valid: false, status: 404, error: "Customer not found or does not belong to your farm" };
    }
  }

  if (supplierId) {
    const supplier = await prisma.supplier.findFirst({ where: { id: Number(supplierId), userId: uid } });
    if (!supplier) {
      return { valid: false, status: 404, error: "Supplier not found or does not belong to your farm" };
    }
  }

  if (feedTypeId) {
    const feedType = await prisma.feedType.findFirst({ where: { id: Number(feedTypeId), userId: uid } });
    if (!feedType) {
      return { valid: false, status: 404, error: "Feed type not found or does not belong to your farm" };
    }
  }

  return { valid: true };
};

const computePaymentState = (amountInput, amountPaidInput, explicitStatus) => {
  const amount = Number(amountInput);
  let amountPaid;

  if (amountPaidInput === undefined || amountPaidInput === null || amountPaidInput === "") {
    amountPaid = amount;
  } else {
    amountPaid = Number(amountPaidInput);
  }

  if (amountPaid < 0) amountPaid = 0;
  if (amountPaid > amount) amountPaid = amount;

  const amountDue = Math.max(0, Number((amount - amountPaid).toFixed(2)));

  let paymentStatus = "PAID";
  if (explicitStatus && ["PAID", "PARTIALLY_PAID", "UNPAID"].includes(explicitStatus)) {
    paymentStatus = explicitStatus;
  } else if (amountDue === 0 || amountPaid >= amount) {
    paymentStatus = "PAID";
  } else if (amountPaid > 0 && amountPaid < amount) {
    paymentStatus = "PARTIALLY_PAID";
  } else if (amountPaid === 0) {
    paymentStatus = "UNPAID";
  }

  return { amount, amountPaid, amountDue, paymentStatus };
};

module.exports = { validateOwnership, computePaymentState };
