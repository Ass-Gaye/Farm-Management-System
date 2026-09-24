/**
 * Handles unexpected errors that reach the end of the Express pipeline.
 *
 * Details are logged on the server, while clients receive a stable generic
 * response instead of an implementation stack trace.
 *
 * @param {Error} err Error passed through next(error)
 * @param {import("express").Request} req Express request
 * @param {import("express").Response} res Express response
 * @param {import("express").NextFunction} next Express next function
 * @returns {void}
 */
const errorMiddleware = (err, req, res, next) => {
  console.error(err);

  // Prisma known errors -> meaningful status codes
  if (err && typeof err.code === "string") {
    if (err.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "Duplicate record. A record with these unique values already exists.",
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Record not found.",
      });
    }
    if (err.code === "P2003") {
      return res.status(400).json({
        success: false,
        message: "Invalid reference. A related record does not exist.",
      });
    }
    // Domain errors thrown with explicit statusCode (e.g. HOUSE_NOT_FOUND)
    if (err.code === "HOUSE_NOT_FOUND" || err.code === "FLOCK_NOT_FOUND") {
      return res.status(404).json({ success: false, message: err.message });
    }
    if (
      err.code === "FLOCK_HOUSE_MISMATCH" ||
      err.code === "UNSUPPORTED_UNIT" ||
      err.code === "INVALID_BAG_WEIGHT"
    ) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  if (err && err.statusCode && Number.isInteger(err.statusCode)) {
    return res
      .status(err.statusCode)
      .json({ success: false, message: err.message || "Request failed" });
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};

module.exports = errorMiddleware;