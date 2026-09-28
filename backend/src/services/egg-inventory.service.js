/**
 * Egg inventory domain helpers (Phase 4.2).
 *
 * EggInventory.currentStock is the authoritative cached stock (pieces);
 * EggMovement is the append-only audit ledger with a per-row balanceAfter
 * snapshot. Every helper here runs on a transaction client and must be
 * called from inside runSerializable().
 */

const EGG_UNIT = "pieces";

// Movement types written by the system. The manual endpoint only accepts
// ADJUSTMENT, WASTAGE, RETURN (enforced in schema + controller).
const EGG_MOVEMENT_TYPES = [
  "PRODUCTION",
  "SALE",
  "ADJUSTMENT",
  "WASTAGE",
  "RETURN",
  "CORRECTION",
];

const MANUAL_EGG_MOVEMENT_TYPES = ["ADJUSTMENT", "WASTAGE", "RETURN"];

/**
 * Returns the user's egg inventory row, creating it at zero stock on
 * first use. Uses upsert so concurrent first-use calls are safe.
 */
const ensureEggInventory = async (tx, userId) =>
  tx.eggInventory.upsert({
    where: { userId: Number(userId) },
    create: { userId: Number(userId), currentStock: 0, unit: EGG_UNIT },
    update: {},
  });

/**
 * Applies a signed stock change and appends the audit movement atomically.
 * Throws code NEGATIVE_EGG_STOCK when the change would drive stock < 0.
 */
const applyEggStockChange = async (
  tx,
  {
    userId,
    delta,
    type,
    houseId = null,
    flockId = null,
    dailyRecordId = null,
    eggSaleId = null,
    correctionId = null,
    date = new Date(),
    reason = null,
  }
) => {
  const inventory = await ensureEggInventory(tx, userId);
  const stockBefore = Number(inventory.currentStock);
  const stockAfter = stockBefore + Number(delta);

  if (stockAfter < 0) {
    const error = new Error(
      `Not enough eggs in stock. Available: ${stockBefore} eggs, required: ${Math.abs(Number(delta))} eggs.`
    );
    error.code = "NEGATIVE_EGG_STOCK";
    throw error;
  }

  await tx.eggInventory.update({
    where: { userId: Number(userId) },
    data: { currentStock: stockAfter },
  });

  const movement = await tx.eggMovement.create({
    data: {
      userId: Number(userId),
      houseId: houseId ? Number(houseId) : null,
      flockId: flockId ? Number(flockId) : null,
      dailyRecordId: dailyRecordId ? Number(dailyRecordId) : null,
      eggSaleId: eggSaleId ? Number(eggSaleId) : null,
      correctionId: correctionId ? Number(correctionId) : null,
      type,
      quantity: Number(delta),
      unit: EGG_UNIT,
      balanceAfter: stockAfter,
      date: new Date(date),
      reason: reason ? String(reason).trim() || null : null,
    },
  });

  return { stockBefore, stockAfter, movement };
};

/**
 * Reverts a previously applied movement: subtracts its quantity effect
 * from stock and removes the movement row (same revert pattern as feed
 * CONSUMPTION reversal). Throws NEGATIVE_EGG_STOCK if the reversal would
 * drive stock below zero (e.g. produced eggs were already sold).
 */
const revertEggMovement = async (tx, movement) => {
  const inventory = await ensureEggInventory(tx, movement.userId);
  const stockBefore = Number(inventory.currentStock);
  const stockAfter = stockBefore - Number(movement.quantity);

  if (stockAfter < 0) {
    const error = new Error(
      `Cannot reverse this egg entry: ${Math.abs(stockAfter)} eggs have already been sold or removed. Available: ${stockBefore} eggs. Adjust sales or wastage first.`
    );
    error.code = "NEGATIVE_EGG_STOCK";
    throw error;
  }

  await tx.eggInventory.update({
    where: { userId: Number(movement.userId) },
    data: { currentStock: stockAfter },
  });

  await tx.eggMovement.delete({ where: { id: movement.id } });

  return { stockBefore, stockAfter };
};

module.exports = {
  EGG_UNIT,
  EGG_MOVEMENT_TYPES,
  MANUAL_EGG_MOVEMENT_TYPES,
  ensureEggInventory,
  applyEggStockChange,
  revertEggMovement,
};
