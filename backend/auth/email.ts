import "server-only";

import { Buffer } from "node:buffer";
import nodemailer from "nodemailer";

function smtpConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!host || !user || !password) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass: password },
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function lunaEmail({
  preheader,
  eyebrow,
  title,
  body,
  actionLabel,
  actionUrl,
  code,
}: {
  preheader: string;
  eyebrow: string;
  title: string;
  body: string;
  actionLabel?: string;
  actionUrl?: string;
  code?: string;
}) {
  const button = actionLabel && actionUrl
    ? `<a href="${escapeHtml(actionUrl)}" style="display:inline-block;border-radius:12px;background:#367674;color:#ffffff;font-weight:700;text-decoration:none;padding:14px 22px">${escapeHtml(actionLabel)}</a>`
    : "";
  const codeBlock = code
    ? `<div style="margin:24px 0;padding:18px;border:1px solid #d8e6e3;border-radius:14px;background:#f1f8f6;text-align:center"><div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#65736f;font-weight:700">Your verification code</div><div style="margin-top:8px;font-size:34px;letter-spacing:.24em;color:#17302e;font-weight:800">${escapeHtml(code)}</div></div>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f7f5;color:#182321;font-family:Arial,Helvetica,sans-serif"><span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</span><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f5;padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #dce7e4;border-radius:22px;overflow:hidden"><tr><td style="padding:28px 32px;background:#17302e;color:#ffffff"><div style="display:inline-flex;align-items:center;gap:10px;font-size:19px;font-weight:800"><span style="display:inline-block;width:34px;height:34px;line-height:34px;border-radius:50%;background:#9ed4c0;color:#17302e;text-align:center;font-size:18px">L</span>Luna</div></td></tr><tr><td style="padding:36px 32px 32px"><div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#367674;font-weight:800">${escapeHtml(eyebrow)}</div><h1 style="margin:12px 0 0;font-size:30px;line-height:1.15;letter-spacing:-.03em;color:#182321">${escapeHtml(title)}</h1><p style="margin:16px 0 0;font-size:16px;line-height:1.65;color:#65736f">${escapeHtml(body)}</p>${codeBlock}${button ? `<div style="margin-top:26px">${button}</div>` : ""}<p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#87918e">If you did not request this, you can safely ignore this email. For your security, never share a verification code.</p></td></tr><tr><td style="padding:18px 32px;border-top:1px solid #e5ecea;color:#87918e;font-size:12px">Luna · calm, clear money management</td></tr></table></td></tr></table></body></html>`;
}

type EmailAttachment = { filename: string; content: Uint8Array; contentType: string };

async function sendMail({ to, subject, text, html, attachments, headers }: { to: string; subject: string; text: string; html: string; attachments?: EmailAttachment[]; headers?: Record<string, string> }) {
  const config = smtpConfig();
  if (!config) throw new Error("SMTP_NOT_CONFIGURED");
  const transporter = nodemailer.createTransport(config);
  const from = process.env.SMTP_FROM || config.auth.user;
  await transporter.sendMail({
    from,
    to,
    replyTo: process.env.SMTP_REPLY_TO || from,
    subject,
    text,
    html,
    headers: {
      "Auto-Submitted": "auto-generated",
      "X-Auto-Response-Suppress": "All",
      ...headers,
    },
    attachments: attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: Buffer.from(attachment.content),
      contentType: attachment.contentType,
    })),
  });
}

export function isSmtpConfigured() {
  return Boolean(smtpConfig());
}

export async function sendPasswordResetEmail({ to, resetUrl }: { to: string; resetUrl: string }) {
  await sendMail({
    to,
    subject: "Reset your Luna password",
    text: `Reset your Luna password using this link. It expires in one hour:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: lunaEmail({
      preheader: "A secure link to reset your Luna password.",
      eyebrow: "Password reset",
      title: "Choose a new password",
      body: "We received a request to reset your Luna password. This secure link expires in one hour.",
      actionLabel: "Reset password",
      actionUrl: resetUrl,
    }),
  });
}

export async function sendEmailVerificationEmail({ to, code, expiresMinutes }: { to: string; code: string; expiresMinutes: number }) {
  await sendMail({
    to,
    subject: "Verify your Luna email",
    text: `Your Luna verification code is ${code}. It expires in ${expiresMinutes} minutes. If you did not create a Luna account, you can ignore this email.`,
    html: lunaEmail({
      preheader: `Your Luna verification code is ${code}.`,
      eyebrow: "Email verification",
      title: "One small step to get started",
      body: `Enter this code in Luna to verify your email address. It expires in ${expiresMinutes} minutes.`,
      code,
    }),
  });
}

export async function sendReportEmail({
  to,
  periodLabel,
  summary,
  reportPdf,
}: {
  to: string;
  periodLabel: string;
  summary: string;
  reportPdf: Uint8Array;
}) {
  const subject = `Your Luna report: ${periodLabel}`;
  const safeSummary = summary.replaceAll("\n", " ").trim();
  await sendMail({
    to,
    subject,
    text: `${subject}\n\n${summary}\n\nYour complete report is attached as a PDF. Open Luna to review the details and insights.`,
    html: lunaEmail({
      preheader: `Your Luna money report for ${periodLabel}.`,
      eyebrow: "Money report",
      title: "Your report is ready",
      body: `${safeSummary} The complete report, including categories, forecast, insights, and suggestions, is attached as a PDF.`,
      actionLabel: "Open Luna reports",
      actionUrl: `${process.env.APP_URL || "http://localhost:3000"}/reports`,
    }),
    headers: { "X-Luna-Message-Type": "personal-report" },
    attachments: [{ filename: `luna-${periodLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`, content: reportPdf, contentType: "application/pdf" }],
  });
}
