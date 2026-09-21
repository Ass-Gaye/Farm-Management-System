const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

const JWT_SECRET =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV === "test" ? "test-jwt-secret-key" : undefined);

if (!JWT_SECRET) {
  throw new Error(
    "FATAL: JWT_SECRET environment variable is not defined. Please set it in your environment."
  );
}

/**
 * Authentication middleware verifying JSON Web Token in the Authorization header.
 * Attaches the authenticated user object to req.user.
 *
 * @param {import("express").Request} req Express request
 * @param {import("express").Response} res Express response
 * @param {import("express").NextFunction} next Next function
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please provide a valid token.",
      });
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token. Please log in again.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account no longer exists.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authenticate,
  JWT_SECRET,
};
