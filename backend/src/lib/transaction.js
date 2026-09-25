const prisma = require("./prisma");

/**
 * Shared serializable-transaction helper (extracted from the Daily Record
 * flow pattern). Retries only transient serialization/deadlock failures;
 * business validation errors are thrown immediately without retry.
 */
const TRANSIENT_CODES = new Set(["P2034", "P2010", "P1213"]);

const runSerializable = async (operation) => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: "Serializable",
        maxWait: 15000,
        timeout: 30000,
      });
    } catch (error) {
      if (!TRANSIENT_CODES.has(error.code) || attempt === 3) {
        throw error;
      }
    }
  }
};

module.exports = { runSerializable };
