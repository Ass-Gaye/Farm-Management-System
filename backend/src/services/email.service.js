const nodemailer = require("nodemailer");

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST) return null;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT) === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  return transporter;
};

const getFromAddress = () =>
  process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || "Poultry Management <onboarding@resend.dev>";

const sendViaResend = async ({ to, subject, text, html }) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null; // not configured -> fall through to SMTP/dev
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: getFromAddress(), to, subject, text, html }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend API ${response.status}: ${detail.slice(0, 300)}`);
  }
  return { sent: true, provider: "resend" };
};

const buildResetLink = (resetToken) => {
  const base = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
  if (!base) return null;
  return `${base}/reset-password?token=${encodeURIComponent(resetToken)}`;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Sends the password-reset email. Never throws — email failure must not
 * reveal whether the account exists, so callers always return the same
 * generic response.
 */
const sendPasswordResetEmail = async ({ to, name, resetToken }) => {
  const resetLink = buildResetLink(resetToken);
  const subject = "Reset your Poultry Management password";
  const safeName = escapeHtml(name || "there");
  const safeToken = escapeHtml(resetToken);
  const safeLink = resetLink ? escapeHtml(resetLink) : null;
  const text = [
    `Hi ${name || "there"},`,
    "",
    "We received a request to reset your Poultry Management password.",
    "This link expires in 1 hour and can only be used once:",
    "",
    resetLink || `Reset token: ${resetToken}`,
    "",
    "If you did not request this, you can safely ignore this email.",
  ].join("\n");
  const actionBlock = safeLink
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto;">
         <tr>
           <td align="center" bgcolor="#1f7a3d" style="border-radius:8px;">
             <a href="${safeLink}" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">Reset my password</a>
           </td>
         </tr>
       </table>
       <p style="margin:0 0 8px;">Button not working? Paste this link into your browser:</p>
       <p style="margin:0 0 16px;word-break:break-all;"><a href="${safeLink}" style="color:#1f7a3d;">${safeLink}</a></p>
       <p style="margin:0;color:#6b7280;font-size:13px;">Or paste this token in the app: <code>${safeToken}</code></p>`
    : `<p style="margin:0 0 16px;">Your reset token (expires in 1 hour, single use): <code>${safeToken}</code></p>`;
  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#f3f4f6;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="480" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td align="center" bgcolor="#1f7a3d" style="padding:28px 24px;">
              <div style="font-size:36px;line-height:1;">&#x1F414;</div>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:20px;font-family:Arial,Helvetica,sans-serif;">Poultry Management</h1>
              <p style="margin:4px 0 0;color:#d1fae5;font-size:14px;font-family:Arial,Helvetica,sans-serif;">Password reset request</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:15px;line-height:1.6;">
              <p style="margin:0 0 12px;">Hi ${safeName},</p>
              <p style="margin:0 0 12px;">We received a request to reset your farm account password. Click the button below to choose a new one. This link <strong>expires in 1 hour</strong> and can only be used <strong>once</strong>.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px;font-family:Arial,Helvetica,sans-serif;color:#111827;font-size:15px;line-height:1.6;">${actionBlock}</td>
          </tr>
          <tr>
            <td style="padding:20px 28px 28px;font-family:Arial,Helvetica,sans-serif;color:#6b7280;font-size:13px;line-height:1.6;border-top:1px solid #e5e7eb;">
              <p style="margin:0;">If you did not request this, you can safely ignore this email — your password will stay the same.</p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;color:#9ca3af;font-size:12px;">Poultry Management System &middot; automated message, please do not reply</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const tx = getTransporter();
  // Preferred: Resend API when RESEND_API_KEY is set.
  try {
    const viaResend = await sendViaResend({ to, subject, text, html });
    if (viaResend) return viaResend;
  } catch (err) {
    console.error("[email] Failed to send password-reset email:", err.message);
    return { sent: false, reason: "SEND_FAILED", provider: "resend" };
  }

  if (!tx) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[email:dev] Password reset for ${to}. Link: ${resetLink || "(no FRONTEND_URL, token withheld from logs)"}`);
    } else {
      console.error("[email] No provider configured (RESEND_API_KEY or SMTP_HOST); password-reset email not sent.");
    }
    return { sent: false, reason: "EMAIL_NOT_CONFIGURED" };
  }

  try {
    await tx.sendMail({
      from: getFromAddress(),
      to,
      subject,
      text,
      html,
    });
    return { sent: true, provider: "smtp" };
  } catch (err) {
    console.error("[email] Failed to send password-reset email:", err.message);
    return { sent: false, reason: "SEND_FAILED" };
  }
};

module.exports = { sendPasswordResetEmail, buildResetLink };
