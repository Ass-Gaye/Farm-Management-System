const prisma = require("../lib/prisma");
const { runSerializable } = require("../lib/transaction");
const {
  getAdjustmentMaps,
  sumCorrectedMortality,
} = require("../services/correction.service");
const { computePaymentState } = require("../services/finance.service");
const { assertFlockOperational } = require("../services/flock-lifecycle.service");

/**
 * Transaction-scoped live-bird calculation (reads via tx client so
 * concurrent mutations are serialized instead of lost).
 */
const calculateLiveBirdsTx = async (tx, flockId, excludeEventId = null) => {
  const flock = await tx.flock.findUnique({
    where: { id: flockId },
    include: {
      dailyRecords: { select: { id: true, mortality: true } },
      depopulationEvents: { select: { id: true, quantity: true } },
    },
  });

  if (!flock) {
    return null;
  }

  const adjMap = await getAdjustmentMaps(
    tx,
    flock.dailyRecords.map((r) => r.id)
  );
  const totalMortality = sumCorrectedMortality(flock.dailyRecords, adjMap);

  const totalDepopulated = flock.depopulationEvents
    .filter((e) => (excludeEventId ? e.id !== excludeEventId : true))
    .reduce((sum, e) => sum + e.quantity, 0);

  const liveBirds = Math.max(0, flock.birdsPlaced - totalMortality - totalDepopulated);

  return {
    birdsPlaced: flock.birdsPlaced,
    totalMortality,
    totalDepopulated,
    liveBirds,
  };
};

/**
 * Calculates the current live bird count for a flock by subtracting
 * total mortality (from daily records) and total depopulated birds
 * (from depopulation events) from the original birds placed.
 *
 * @param {number} flockId
 * @param {number|null} excludeEventId - Optionally exclude a specific event (for updates)
 * @returns {Promise<{birdsPlaced: number, totalMortality: number, totalDepopulated: number, liveBirds: number}>}
 */
const calculateLiveBirds = async (flockId, excludeEventId = null) => {
  const flock = await prisma.flock.findUnique({
    where: { id: flockId },
    include: {
      dailyRecords: { select: { id: true, mortality: true } },
      depopulationEvents: { select: { id: true, quantity: true } },
    },
  });

  if (!flock) {
    return null;
  }

  // Mortality sums use corrected values so historical corrections flow
  // into availability checks.
  const adjMap = await getAdjustmentMaps(
    prisma,
    flock.dailyRecords.map((r) => r.id)
  );
  const totalMortality = sumCorrectedMortality(flock.dailyRecords, adjMap);

  const totalDepopulated = flock.depopulationEvents
    .filter((e) => (excludeEventId ? e.id !== excludeEventId : true))
    .reduce((sum, e) => sum + e.quantity, 0);

  const liveBirds = Math.max(0, flock.birdsPlaced - totalMortality - totalDepopulated);

  return {
    birdsPlaced: flock.birdsPlaced,
    totalMortality,
    totalDepopulated,
    liveBirds,
  };
};

/**
 * Creates a new depopulation event for a flock.
 * Supports both /api/depopulation-events (with flockId in body)
 * and /api/flocks/:flockId/depopulation-events.
 */
const createDepopulationEvent = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const rawFlockId = req.params.flockId || req.body.flockId;
    const flockId = rawFlockId ? Number(rawFlockId) : null;
    const {
      quantity,
      reason,
      date,
      notes,
      incomeId,
      unitPrice,
      amount,
      customerId,
      amountPaid,
      paymentStatus,
    } = req.body;

    if (!flockId) {
      return res.status(400).json({
        success: false,
        message: "flockId is required",
      });
    }

    const numQuantity = Number(quantity);
    if (!numQuantity || numQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be greater than 0",
      });
    }

    // All bird-count reads/writes and income creation happen inside one
    // serializable transaction (ownership, headroom, create, flock sync).
    let event;
    let liveBirdsAfter;
    try {
      const result = await runSerializable(async (tx) => {
        // Verify flock ownership inside the transaction
        const ownedFlock = await tx.flock.findFirst({
          where: { id: flockId, userId },
        });
        if (!ownedFlock) {
          const error = new Error("Flock not found or does not belong to your farm");
          error.code = "FLOCK_NOT_FOUND";
          throw error;
        }

        // Phase 4.4 — closed flocks reject new operational records.
        assertFlockOperational(ownedFlock);

        // Calculate available live birds inside the transaction
        const birdStats = await calculateLiveBirdsTx(tx, flockId);
        if (numQuantity > birdStats.liveBirds) {
          const error = new Error(
            `Cannot remove ${numQuantity} birds. Only ${birdStats.liveBirds} live birds available (${birdStats.birdsPlaced} placed - ${birdStats.totalMortality} mortality - ${birdStats.totalDepopulated} previously depopulated)`
          );
          error.code = "NO_HEADROOM";
          throw error;
        }

        // If customerId is provided, verify it belongs to this user
        if (customerId) {
          const customer = await tx.customer.findFirst({
            where: { id: Number(customerId), userId },
          });
          if (!customer) {
            const error = new Error("Customer not found or does not belong to your farm");
            error.code = "CUSTOMER_NOT_FOUND";
            throw error;
          }
        }

        // If incomeId is provided, verify it belongs to this user
        if (incomeId) {
          const income = await tx.income.findFirst({
            where: { id: Number(incomeId), userId },
          });
          if (!income) {
            const error = new Error("Income record not found or does not belong to your farm");
            error.code = "INCOME_NOT_FOUND";
            throw error;
          }
        }

        let resolvedIncomeId = incomeId ? Number(incomeId) : null;

        // Automatically create Income if reason === "SOLD" and no incomeId was provided
        if (reason === "SOLD" && !resolvedIncomeId) {
          let finalAmount = amount !== undefined && amount !== null && amount !== "" ? Number(amount) : null;
          if (finalAmount === null && unitPrice !== undefined && unitPrice !== null && unitPrice !== "") {
            finalAmount = Number((numQuantity * Number(unitPrice)).toFixed(2));
          }

          if (finalAmount !== null && finalAmount > 0) {
            const payState = computePaymentState(finalAmount, amountPaid, paymentStatus);
            const numUnitPrice =
              unitPrice !== undefined && unitPrice !== null && unitPrice !== ""
                ? Number(unitPrice)
                : Number((payState.amount / numQuantity).toFixed(2));

            const createdIncome = await tx.income.create({
              data: {
                userId,
                houseId: ownedFlock.houseId,
                flockId: ownedFlock.id,
                breedId: ownedFlock.breedId,
                customerId: customerId ? Number(customerId) : null,
                category: "Bird sales",
                amount: payState.amount,
                date: new Date(date),
                description: notes ? notes.trim() : `Bird sale: ${numQuantity} birds from flock ${ownedFlock.name}`,
                quantity: numQuantity,
                unit: "birds",
                unitPrice: numUnitPrice,
                amountPaid: payState.amountPaid,
                amountDue: payState.amountDue,
                paymentStatus: payState.paymentStatus,
              },
            });
            resolvedIncomeId = createdIncome.id;
          }
        }

        const created = await tx.depopulationEvent.create({
          data: {
            userId,
            flockId,
            quantity: numQuantity,
            reason,
            date: new Date(date),
            notes: notes ? notes.trim() : null,
            incomeId: resolvedIncomeId,
          },
          include: {
            flock: { select: { id: true, name: true, batchNumber: true } },
            income: {
              select: {
                id: true,
                amount: true,
                category: true,
                customerId: true,
                unitPrice: true,
                amountPaid: true,
                amountDue: true,
                paymentStatus: true,
                customer: { select: { id: true, name: true, phone: true } },
              },
            },
          },
        });

        // Update the flock's currentBirds field in the same transaction
        const updatedStats = await calculateLiveBirdsTx(tx, flockId);
        await tx.flock.update({
          where: { id: flockId },
          data: { currentBirds: updatedStats.liveBirds },
        });

        return { created, liveBirdsAfter: updatedStats.liveBirds };
      });
      event = result.created;
      liveBirdsAfter = result.liveBirdsAfter;
    } catch (error) {
      if (
        error.code === "FLOCK_NOT_FOUND" ||
        error.code === "INCOME_NOT_FOUND" ||
        error.code === "CUSTOMER_NOT_FOUND"
      ) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      if (error.code === "NO_HEADROOM" || error.code === "FLOCK_NOT_ACTIVE") {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      throw error;
    }

    res.status(201).json({
      success: true,
      message: "Depopulation event recorded successfully",
      data: {
        ...event,
        liveBirdsAfter,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves depopulation events.
 * If flockId is provided (in params or query), filters by that flock and includes summary.
 * Otherwise returns all depopulation events for the authenticated user.
 */
const getDepopulationEvents = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const rawFlockId = req.params.flockId || req.query.flockId;
    const flockId = rawFlockId ? Number(rawFlockId) : null;

    if (flockId) {
      // Verify flock ownership
      const flock = await prisma.flock.findFirst({
        where: { id: flockId, userId },
      });

      if (!flock) {
        return res.status(404).json({
          success: false,
          message: "Flock not found or does not belong to your farm",
        });
      }
    }

    const where = {
      userId,
      ...(flockId ? { flockId } : {}),
    };

    const events = await prisma.depopulationEvent.findMany({
      where,
      include: {
        flock: { select: { id: true, name: true, batchNumber: true } },
        income: {
          select: {
            id: true,
            amount: true,
            category: true,
            customerId: true,
            unitPrice: true,
            amountPaid: true,
            amountDue: true,
            paymentStatus: true,
            customer: { select: { id: true, name: true, phone: true } },
          },
        },
      },
      orderBy: { date: "desc" },
    });

    // Include summary stats when flockId is specified
    const birdStats = flockId ? await calculateLiveBirds(flockId) : null;

    res.json({
      success: true,
      data: {
        events,
        summary: birdStats,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves a single depopulation event by ID.
 * Enforces authenticated user ownership.
 */
const getDepopulationEventById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const eventId = Number(req.params.id);
    const rawFlockId = req.params.flockId || req.query.flockId;
    const flockId = rawFlockId ? Number(rawFlockId) : null;

    const event = await prisma.depopulationEvent.findFirst({
      where: {
        id: eventId,
        userId,
        ...(flockId ? { flockId } : {}),
      },
      include: {
        flock: { select: { id: true, name: true, batchNumber: true } },
        income: {
          select: {
            id: true,
            amount: true,
            category: true,
            customerId: true,
            unitPrice: true,
            amountPaid: true,
            amountDue: true,
            paymentStatus: true,
            customer: { select: { id: true, name: true, phone: true } },
          },
        },
      },
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Depopulation event not found",
      });
    }

    res.json({
      success: true,
      data: event,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates an existing depopulation event.
 * Enforces authenticated user ownership and validates against live birds headroom.
 */
const updateDepopulationEvent = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const eventId = Number(req.params.id);
    const {
      quantity,
      reason,
      date,
      notes,
      incomeId,
      unitPrice,
      amount,
      customerId,
      amountPaid,
      paymentStatus,
    } = req.body;

    // Verify event ownership
    const existing = await prisma.depopulationEvent.findFirst({
      where: { id: eventId, userId },
      include: { income: true },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Depopulation event not found",
      });
    }

    const flockId = existing.flockId;

    // Pre-validate quantity shape outside the transaction; headroom is
    // re-validated inside the transaction against fresh reads.
    const newQuantity = quantity !== undefined ? Number(quantity) : existing.quantity;
    if (quantity !== undefined && newQuantity !== existing.quantity && newQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be greater than 0",
      });
    }

    const targetReason = reason !== undefined ? reason : existing.reason;

    let updated;
    let liveBirdsAfter;
    try {
      const result = await runSerializable(async (tx) => {
        const ownedFlock = await tx.flock.findFirst({
          where: { id: flockId, userId },
        });
        if (!ownedFlock) {
          const error = new Error("Flock not found or does not belong to your farm");
          error.code = "FLOCK_NOT_FOUND";
          throw error;
        }

        if (quantity !== undefined && newQuantity !== existing.quantity) {
          // Exclude this event from the calculation to check available headroom
          const birdStats = await calculateLiveBirdsTx(tx, flockId, eventId);
          if (newQuantity > birdStats.liveBirds) {
            const error = new Error(
              `Cannot set quantity to ${newQuantity}. Only ${birdStats.liveBirds} live birds available after accounting for other events`
            );
            error.code = "NO_HEADROOM";
            throw error;
          }
        }

        // If customerId is provided, verify it belongs to this user
        if (customerId) {
          const customer = await tx.customer.findFirst({
            where: { id: Number(customerId), userId },
          });
          if (!customer) {
            const error = new Error("Customer not found or does not belong to your farm");
            error.code = "CUSTOMER_NOT_FOUND";
            throw error;
          }
        }

        // If incomeId is provided, verify it belongs to this user
        if (incomeId) {
          const income = await tx.income.findFirst({
            where: { id: Number(incomeId), userId },
          });
          if (!income) {
            const error = new Error("Income record not found or does not belong to your farm");
            error.code = "INCOME_NOT_FOUND";
            throw error;
          }
        }

        let resolvedIncomeId =
          incomeId !== undefined ? (incomeId ? Number(incomeId) : null) : existing.incomeId;

        // Transition handling:
        if (targetReason === "SOLD") {
          if (resolvedIncomeId) {
            // Update linked Income if exists and belongs to this user
            const linkedIncome = await tx.income.findFirst({
              where: { id: resolvedIncomeId, userId },
            });
            if (linkedIncome) {
              const effectiveQty = newQuantity;
              let effectiveUnitPrice =
                unitPrice !== undefined
                  ? unitPrice !== null && unitPrice !== ""
                    ? Number(unitPrice)
                    : null
                  : linkedIncome.unitPrice
                  ? Number(linkedIncome.unitPrice)
                  : null;

              let effectiveAmount =
                amount !== undefined && amount !== null && amount !== "" ? Number(amount) : null;
              if (effectiveAmount === null) {
                if (effectiveUnitPrice !== null) {
                  effectiveAmount = Number((effectiveQty * effectiveUnitPrice).toFixed(2));
                } else if (quantity !== undefined && newQuantity !== existing.quantity && existing.quantity > 0) {
                  // Adjust amount proportionally to quantity
                  const unitRate = Number(linkedIncome.amount) / existing.quantity;
                  effectiveAmount = Number((effectiveQty * unitRate).toFixed(2));
                } else {
                  effectiveAmount = Number(linkedIncome.amount);
                }
              }

              const wasFullyPaid =
                Number(linkedIncome.amountDue || 0) === 0 ||
                Number(linkedIncome.amountPaid || 0) >= Number(linkedIncome.amount);
              const effectivePaid =
                amountPaid !== undefined && amountPaid !== null && amountPaid !== ""
                  ? Math.min(Number(amountPaid), effectiveAmount)
                  : wasFullyPaid
                  ? effectiveAmount
                  : Math.min(Number(linkedIncome.amountPaid || 0), effectiveAmount);

              const payState = computePaymentState(
                effectiveAmount,
                effectivePaid,
                paymentStatus || linkedIncome.paymentStatus
              );
              const targetCustomerId =
                customerId !== undefined
                  ? customerId
                    ? Number(customerId)
                    : null
                  : linkedIncome.customerId;

              await tx.income.update({
                where: { id: linkedIncome.id },
                data: {
                  amount: payState.amount,
                  quantity: effectiveQty,
                  unitPrice: effectiveUnitPrice,
                  amountPaid: payState.amountPaid,
                  amountDue: payState.amountDue,
                  paymentStatus: payState.paymentStatus,
                  customerId: targetCustomerId,
                  date: date ? new Date(date) : linkedIncome.date,
                  description:
                    notes !== undefined
                      ? notes
                        ? notes.trim()
                        : null
                      : linkedIncome.description,
                },
              });
            }
          } else {
            // Event was non-SOLD or didn't have incomeId, now it is SOLD: check if sale info provided to create Income
            let finalAmount =
              amount !== undefined && amount !== null && amount !== "" ? Number(amount) : null;
            if (finalAmount === null && unitPrice !== undefined && unitPrice !== null && unitPrice !== "") {
              finalAmount = Number((newQuantity * Number(unitPrice)).toFixed(2));
            }

            if (finalAmount !== null && finalAmount > 0) {
              const payState = computePaymentState(finalAmount, amountPaid, paymentStatus);
              const numUnitPrice =
                unitPrice !== undefined && unitPrice !== null && unitPrice !== ""
                  ? Number(unitPrice)
                  : Number((payState.amount / newQuantity).toFixed(2));

              const createdIncome = await tx.income.create({
                data: {
                  userId,
                  houseId: ownedFlock.houseId,
                  flockId: ownedFlock.id,
                  breedId: ownedFlock.breedId,
                  customerId: customerId ? Number(customerId) : null,
                  category: "Bird sales",
                  amount: payState.amount,
                  date: date ? new Date(date) : existing.date,
                  description: notes
                    ? notes.trim()
                    : `Bird sale: ${newQuantity} birds from flock ${ownedFlock.name}`,
                  quantity: newQuantity,
                  unit: "birds",
                  unitPrice: numUnitPrice,
                  amountPaid: payState.amountPaid,
                  amountDue: payState.amountDue,
                  paymentStatus: payState.paymentStatus,
                },
              });
              resolvedIncomeId = createdIncome.id;
            }
          }
        } else {
          // Reason changed from SOLD to non-SOLD: clean up linked Income if any
          if (existing.incomeId) {
            const otherEvents = await tx.depopulationEvent.count({
              where: { incomeId: existing.incomeId, id: { not: eventId } },
            });
            if (otherEvents === 0) {
              // Only delete the linked Income when it belongs to this user;
              // otherwise just unlink so no foreign record is removed.
              const ownedIncome = await tx.income.findFirst({
                where: { id: existing.incomeId, userId },
              });
              if (ownedIncome) {
                await tx.income.delete({
                  where: { id: existing.incomeId },
                });
              }
            }
            resolvedIncomeId = null;
          }
        }

        const saved = await tx.depopulationEvent.update({
          where: { id: eventId },
          data: {
            quantity: newQuantity,
            reason: targetReason,
            date: date ? new Date(date) : existing.date,
            notes: notes !== undefined ? (notes ? notes.trim() : null) : existing.notes,
            incomeId: resolvedIncomeId,
          },
          include: {
            flock: { select: { id: true, name: true, batchNumber: true } },
            income: {
              select: {
                id: true,
                amount: true,
                category: true,
                customerId: true,
                unitPrice: true,
                amountPaid: true,
                amountDue: true,
                paymentStatus: true,
                customer: { select: { id: true, name: true, phone: true } },
              },
            },
          },
        });

        // Sync flock's currentBirds in the same transaction
        const updatedStats = await calculateLiveBirdsTx(tx, flockId);
        await tx.flock.update({
          where: { id: flockId },
          data: { currentBirds: updatedStats.liveBirds },
        });

        return { saved, liveBirdsAfter: updatedStats.liveBirds };
      });
      updated = result.saved;
      liveBirdsAfter = result.liveBirdsAfter;
    } catch (error) {
      if (
        error.code === "FLOCK_NOT_FOUND" ||
        error.code === "INCOME_NOT_FOUND" ||
        error.code === "CUSTOMER_NOT_FOUND"
      ) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      if (error.code === "NO_HEADROOM") {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      throw error;
    }

    res.json({
      success: true,
      message: "Depopulation event updated successfully",
      data: {
        ...updated,
        liveBirdsAfter,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deletes a depopulation event and restores the flock's bird count.
 * Also cleans up linked Income if no other depopulation event references it.
 * Enforces authenticated user ownership.
 */
const deleteDepopulationEvent = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const eventId = Number(req.params.id);

    const existing = await prisma.depopulationEvent.findFirst({
      where: { id: eventId, userId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Depopulation event not found",
      });
    }

    const flockId = existing.flockId;

    const { liveBirdsAfter } = await runSerializable(async (tx) => {
      // If linked to an income record, delete that income if no other depopulation event references it
      if (existing.incomeId) {
        const otherEvents = await tx.depopulationEvent.count({
          where: { incomeId: existing.incomeId, id: { not: eventId } },
        });
        if (otherEvents === 0) {
          // Only delete when the linked Income belongs to this user.
          const ownedIncome = await tx.income.findFirst({
            where: { id: existing.incomeId, userId },
          });
          if (ownedIncome) {
            await tx.income.delete({
              where: { id: existing.incomeId },
            });
          }
        }
      }

      await tx.depopulationEvent.delete({
        where: { id: eventId },
      });

      // Sync flock's currentBirds in the same transaction
      const updatedStats = await calculateLiveBirdsTx(tx, flockId);
      await tx.flock.update({
        where: { id: flockId },
        data: { currentBirds: updatedStats.liveBirds },
      });

      return { liveBirdsAfter: updatedStats.liveBirds };
    });

    res.json({
      success: true,
      message: "Depopulation event deleted successfully",
      data: {
        liveBirdsAfter,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createDepopulationEvent,
  getDepopulationEvents,
  getDepopulationEventById,
  updateDepopulationEvent,
  deleteDepopulationEvent,
  calculateLiveBirds,
};
