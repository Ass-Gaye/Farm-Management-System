const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const { sendPasswordResetEmail } = require("../services/email.service");
const { JWT_SECRET } = require("../middleware/auth.middleware");

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

/**
 * Registers a new user account.
 */
const register = async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name: name.trim(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      success: true,
      message: "Registration successful",
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Authenticates user credentials and returns a JWT.
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Returns the currently authenticated user's profile.
 */
const getMe = async (req, res) => {
  res.json({
    success: true,
    data: req.user,
  });
};

/**
 * Updates the user's name or email.
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const updateData = {};

    if (name) {
      updateData.name = name.trim();
    }

    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      if (normalizedEmail !== req.user.email) {
        const existing = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });
        if (existing) {
          return res.status(409).json({
            success: false,
            message: "An account with this email already exists",
          });
        }
        updateData.email = normalizedEmail;
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Changes user password after verifying the current password.
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Initiates a password reset request.
 * If the account exists, emails a single-use token valid for 1 hour.
 * Always returns the same generic message so callers cannot enumerate users.
 */
const GENERIC_RESET_MESSAGE =
  "If an account with that email exists, we have sent password reset instructions to it.";

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Unknown address: same generic response, no email, no token.
    if (!user) {
      return res.json({ success: true, message: GENERIC_RESET_MESSAGE });
    }

    // Generate a single-use, 1-hour reset token signed with JWT_SECRET + user.password
    // Once the user's password changes, the secret changes and the token is automatically invalidated!
    const secret = `${JWT_SECRET}-${user.password}`;
    const resetToken = jwt.sign(
      { userId: user.id, email: user.email, purpose: "reset_password" },
      secret,
      { expiresIn: "1h" }
    );

    // Deliver out-of-band. Failures are logged only; response stays generic.
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetToken,
    });

    console.log(
      `Password reset requested for user id=${user.id}. Email dispatched (or logged in dev), token valid 1h.`
    );

    // Explicit opt-in only: expose the token so integration tests can
    // complete the reset flow without a mailbox. NODE_ENV must NOT
    // grant exposure on its own (production misconfiguration risk).
    const exposeToken = process.env.ALLOW_RESET_TOKEN_IN_RESPONSE === "true";

    res.json({
      success: true,
      message: GENERIC_RESET_MESSAGE,
      ...(exposeToken
        ? { data: { resetToken, email: user.email } }
        : {}),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resets user password using the verified reset token.
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    const decoded = jwt.decode(token);
    if (!decoded || !decoded.userId || decoded.purpose !== "reset_password") {
      return res.status(400).json({
        success: false,
        message: "Invalid or malformed password reset token",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found",
      });
    }

    try {
      const secret = `${JWT_SECRET}-${user.password}`;
      jwt.verify(token, secret);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message:
          err.name === "TokenExpiredError"
            ? "Password reset token has expired. Please request a new one."
            : "Password reset token is invalid or has already been used.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    res.json({
      success: true,
      message: "Password has been reset successfully. You can now log in.",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
};

