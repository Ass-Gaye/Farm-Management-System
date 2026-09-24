/**
 * Builds middleware that validates and parses a JSON request body with Zod.
 *
 * Parsed data replaces req.body so controllers receive coerced values such
 * as validated Date instances instead of untrusted raw input.
 *
 * @param {{ safeParse: Function }} schema Zod-compatible object schema
 * @returns {import("express").RequestHandler} Express validation middleware
 */
const validate = (schema) => {

  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: result.error.flatten().fieldErrors, // takes zod errors and organizes them by field.
      });
    }

    req.body = result.data;

    next();
  };

};

const validateParams = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid route parameters",
        errors: result.error.flatten().fieldErrors,
      });
    }

    req.params = result.data;
    next();
  };
};

module.exports = {
  validate,
  validateParams,
};