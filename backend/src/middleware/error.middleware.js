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

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};

module.exports = errorMiddleware;