import net from "node:net";
import path from "node:path";
import tls from "node:tls";
import { appendFile, mkdir } from "node:fs/promises";
import { prisma } from "./db";
import {
  appendMailDeliveryLog,
  DEFAULT_CONTACT_RECIPIENT_EMAIL,
  getPlatformEmailRuntimeSecrets,
  type PlatformEmailRuntimeSecrets,
} from "./email-config";

export const CONTACT_RECIPIENT_EMAIL = DEFAULT_CONTACT_RECIPIENT_EMAIL;

export type MailAttachment = {
  filename: string;
  contentType: string;
  base64Content: string;
};

type MailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: MailAttachment[];
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);

function safeAttachmentFilename(value: string): string {
  return value.replace(/[\r\n"\\/]+/g, "_").trim().slice(0, 180) || "attachment";
}

function attachmentBase64(value: string): string {
  return value.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
}

type SmtpResponse = { code: number; text: string };

function readSmtpResponse(socket: net.Socket): Promise<SmtpResponse> {
  return new Promise((resolve, reject) => {
    let data = "";
    const onData = (chunk: Buffer) => {
      data += chunk.toString("utf8");
      const lines = data.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1] ?? "";
      if (/^\d{3}\s/.test(last)) {
        cleanup();
        resolve({ code: Number(last.slice(0, 3)), text: data });
      }
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
    };
    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function smtpCommand(socket: net.Socket, command: string): Promise<SmtpResponse> {
  socket.write(`${command}\r\n`);
  return readSmtpResponse(socket);
}

async function sendSmtp(input: MailInput, runtime: PlatformEmailRuntimeSecrets): Promise<void> {
  const host = runtime.smtpHost;
  const port = runtime.smtpPort;
  const user = runtime.smtpUser;
  const pass = runtime.smtpPass;
  const from = runtime.fromAddress || "QASyn <no-reply@qasyn.com>";
  if (!host) throw new Error("SMTP_HOST is not configured.");

  const secure = runtime.smtpSecure;
  let socket: net.Socket = secure
    ? tls.connect({ host, port, servername: host })
    : net.connect({ host, port });
  await new Promise<void>((resolve, reject) => {
    socket.once(secure ? "secureConnect" : "connect", resolve);
    socket.once("error", reject);
  });

  try {
    const greeting = await readSmtpResponse(socket);
    if (greeting.code >= 400) throw new Error(`SMTP greeting rejected: ${greeting.text}`);
    await smtpCommand(socket, "EHLO qasyn.com");
    if (!secure) {
      const startTls = await smtpCommand(socket, "STARTTLS");
      if (startTls.code === 220) {
        socket = tls.connect({ socket, servername: host });
        await new Promise<void>((resolve, reject) => {
          socket.once("secureConnect", resolve);
          socket.once("error", reject);
        });
        await smtpCommand(socket, "EHLO qasyn.com");
      }
    }
    if (user && pass) {
      const plainPayload = Buffer.from(`\0${user}\0${pass}`, "utf8").toString("base64");
      let authRes = await smtpCommand(socket, `AUTH PLAIN ${plainPayload}`);
      if (authRes.code === 334) authRes = await smtpCommand(socket, plainPayload);
      if (authRes.code >= 400) {
        const login = await smtpCommand(socket, "AUTH LOGIN");
        if (login.code === 334) {
          const userRes = await smtpCommand(socket, Buffer.from(user, "utf8").toString("base64"));
          if (userRes.code === 334) {
            authRes = await smtpCommand(socket, Buffer.from(pass, "utf8").toString("base64"));
          } else {
            authRes = userRes;
          }
        } else {
          authRes = login;
        }
      }
      if (authRes.code >= 400) throw new Error(`SMTP AUTH rejected: ${authRes.text}`);
    }
    const sanitizeHeader = (value: string) => value.replace(/[\r\n]+/g, " ").trim();
    const envelopeTo = input.to.replace(/[\r\n]+/g, "").trim();
    const mailFrom = await smtpCommand(socket, `MAIL FROM:<${from.replace(/^.*<|>.*$/g, "")}>`);
    if (mailFrom.code >= 400) throw new Error(`SMTP MAIL FROM rejected: ${mailFrom.text}`);
    const rcpt = await smtpCommand(socket, `RCPT TO:<${envelopeTo}>`);
    if (rcpt.code >= 400) throw new Error(`SMTP RCPT TO rejected: ${rcpt.text}`);
    const data = await smtpCommand(socket, "DATA");
    if (data.code !== 354) throw new Error(`SMTP DATA rejected: ${data.text}`);
    const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2, 10)}@qasyn.com>`;
    const headers = [
      `From: ${sanitizeHeader(from)}`,
      `To: ${sanitizeHeader(input.to)}`,
      `Subject: ${sanitizeHeader(input.subject)}`,
      ...(input.replyTo ? [`Reply-To: ${sanitizeHeader(input.replyTo)}`] : []),
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: ${messageId}`,
      "MIME-Version: 1.0",
    ];
    const attachments = (input.attachments ?? []).filter((attachment) => attachment.base64Content);
    let message: string;
    if (attachments.length === 0) {
      headers.push('Content-Type: text/html; charset="UTF-8"');
      message = `${headers.join("\r\n")}\r\n\r\n${input.html}`;
    } else {
      const boundary = `qasyn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
      const parts: string[] = [
        `--${boundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        "Content-Transfer-Encoding: 8bit",
        "",
        input.html,
      ];
      for (const attachment of attachments) {
        const filename = safeAttachmentFilename(attachment.filename);
        const contentType = sanitizeHeader(attachment.contentType || "application/octet-stream");
        const base64 = attachmentBase64(attachment.base64Content).replace(/(.{76})/g, "$1\r\n");
        parts.push(
          `--${boundary}`,
          `Content-Type: ${contentType}; name="${filename}"`,
          `Content-Disposition: attachment; filename="${filename}"`,
          "Content-Transfer-Encoding: base64",
          "",
          base64,
        );
      }
      parts.push(`--${boundary}--`, "");
      message = `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}`;
    }
    const normalized = message.replace(/\r?\n/g, "\r\n");
    const dotStuffed = normalized
      .split("\r\n")
      .map((line) => (line.startsWith(".") ? `.${line}` : line))
      .join("\r\n");
    socket.write(`${dotStuffed}\r\n.\r\n`);
    const accepted = await readSmtpResponse(socket);
    if (accepted.code >= 400) throw new Error(`SMTP message rejected: ${accepted.text}`);
    await smtpCommand(socket, "QUIT").catch(() => undefined);
  } finally {
    socket.end();
    socket.destroy();
  }
}

async function sendResend(input: MailInput, runtime: PlatformEmailRuntimeSecrets): Promise<void> {
  const key = runtime.resendApiKey;
  if (!key) throw new Error("RESEND_API_KEY is not configured.");
  const clean = (value: string) => value.replace(/[\r\n]+/g, " ").trim();
  const from = clean(runtime.fromAddress || "QASyn <no-reply@qasyn.com>");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [clean(input.to)],
      subject: clean(input.subject),
      html: input.html,
      text: input.text,
      ...(input.replyTo ? { reply_to: clean(input.replyTo) } : {}),
      ...(input.attachments?.length
        ? {
            attachments: input.attachments.map((attachment) => ({
              filename: safeAttachmentFilename(attachment.filename),
              content: attachmentBase64(attachment.base64Content),
            })),
          }
        : {}),
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend rejected the message (${response.status}): ${body.slice(0, 220)}`);
  }
}

/** Sends an email via SMTP, Resend, or the persistent SQLite outbox fallback. */
export async function sendMail(
  input: MailInput,
  runtime?: PlatformEmailRuntimeSecrets,
): Promise<{ provider: "smtp" | "resend" | "outbox"; status: "sent" | "queued" | "failed" }> {
  const config = runtime ?? (await getPlatformEmailRuntimeSecrets());
  const text = input.text ?? input.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  let provider: "smtp" | "resend" | "outbox" = "outbox";
  let status: "sent" | "queued" | "failed" = "queued";
  let error: string | null = null;
  try {
    if (config.enabled && config.provider === "resend" && config.resendApiKey) {
      provider = "resend";
      await sendResend(input, config);
      status = "sent";
    } else if (config.enabled && config.smtpHost) {
      provider = "smtp";
      await sendSmtp(input, config);
      status = "sent";
    } else if (config.enabled && config.resendApiKey) {
      provider = "resend";
      await sendResend(input, config);
      status = "sent";
    }
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
    console.warn("[mailer] delivery failed; keeping the message in the outbox", error);
    status = "failed";
    provider = "outbox";
  }
  try {
    await prisma.emailOutbox.create({ data: { to: input.to, subject: input.subject, html: input.html, text, provider, status, error } });
  } catch (caught) {
    console.warn("[mailer] outbox persistence failed", caught instanceof Error ? caught.message : String(caught));
  }
  await appendMailDeliveryLog({
    at: new Date().toISOString(),
    to: input.to,
    subject: input.subject,
    provider,
    status,
    error,
  });
  return { provider, status };
}

export async function sendVerificationEmail(email: string, code: string): Promise<void> {
  await sendMail({
    to: email,
    subject: "Your QASyn verification code",
    html: `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:auto;padding:24px"><h2>Verify your QASyn account</h2><p>Enter this 6-digit code to activate your workspace:</p><p style="font:700 30px/1.2 ui-monospace,Consolas,monospace;letter-spacing:8px;color:#4f46e5">${code}</p><p>The code expires in 15 minutes. If you did not request it, ignore this message.</p><p style="color:#6b7280;font-size:12px">QASyn · Autonomous Quality Engineering</p></div>`,
    text: `Your QASyn verification code is ${code}. It expires in 15 minutes.`,
  });
}

export async function sendLeadNotificationEmail(input: {
  kind: "demo" | "contact" | "career";
  name: string;
  email: string;
  company?: string;
  role?: string;
  jobTitle?: string;
  portfolioUrl?: string;
  message?: string;
  source?: string;
  attachments?: MailAttachment[];
}): Promise<{ provider: "smtp" | "resend" | "outbox"; status: "sent" | "queued" | "failed" }> {
  const runtime = await getPlatformEmailRuntimeSecrets();
  const recipient = runtime.contactRecipientEmail;
  const label = input.kind === "demo" ? "Demo request" : input.kind === "career" ? "Job application" : "Contact request";
  const rows: Array<[string, string]> = [
    ["Type", label],
    ["Name", input.name],
    ["Email", input.email],
    ...(input.source ? ([["Source", input.source]] as Array<[string, string]>) : []),
    ...(input.company ? ([["Company", input.company]] as Array<[string, string]>) : []),
    ...(input.role ? ([["Team size / role", input.role]] as Array<[string, string]>) : []),
    ...(input.jobTitle ? ([["Role applied for", input.jobTitle]] as Array<[string, string]>) : []),
    ...(input.portfolioUrl ? ([["Portfolio / LinkedIn / GitHub", input.portfolioUrl]] as Array<[string, string]>) : []),
    ...(input.message ? ([["Message / experience", input.message]] as Array<[string, string]>) : []),
    ...(input.attachments?.length ? ([["Attachments", input.attachments.map((attachment) => attachment.filename).join(", ")]] as Array<[string, string]>) : []),
  ];
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:auto;padding:24px"><h2>QASyn ${escapeHtml(label)}</h2><table style="border-collapse:collapse;width:100%">${rows
    .map(([key, value]) => `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;vertical-align:top">${escapeHtml(key)}</td><td style="padding:6px 0;color:#111827;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`)
    .join("")}</table><p style="color:#6b7280;font-size:12px;margin-top:24px">Sent to ${escapeHtml(recipient)} by the QASyn marketing site.</p></div>`;
  const text = [`QASyn ${label}`, ...rows.map(([key, value]) => `${key}: ${value}`), `Recipient: ${recipient}`].join("\n");
  const safeName = input.name.replace(/["\\\r\n]+/g, " ").trim() || "QASyn Lead";
  const subjectSuffix = input.kind === "contact" && input.source ? ` · ${input.source}` : "";
  const result = await sendMail(
    {
      to: recipient,
      subject: `QASyn ${label}: ${input.name}${subjectSuffix}`,
      html,
      text,
      replyTo: `"${safeName}" <${input.email}>`,
      attachments: input.attachments,
    },
    runtime,
  );
  try {
    const logDir = path.join(process.cwd(), ".qasyn-data");
    await mkdir(logDir, { recursive: true });
    await appendFile(
      path.join(logDir, "mail.log"),
      `${JSON.stringify({ at: new Date().toISOString(), kind: input.kind, name: input.name, email: input.email, to: recipient, provider: result.provider, status: result.status })}\n`,
      "utf8",
    );
  } catch (error) {
    console.warn("[mailer] lead notification log skipped", error instanceof Error ? error.message : String(error));
  }
  return result;
}

export async function sendLeadConfirmationEmailToSender(input: {
  kind: "demo" | "contact" | "career";
  name: string;
  email: string;
  company?: string;
  role?: string;
  jobTitle?: string;
  message?: string;
  hasCv?: boolean;
  hasCoverLetter?: boolean;
}): Promise<{ provider: "smtp" | "resend" | "outbox"; status: "sent" | "queued" | "failed" }> {
  const name = input.name.trim() || "there";
  const safeName = escapeHtml(name);
  let subject: string;
  let heading: string;
  let bodyHtml: string;
  let bodyText: string;

  if (input.kind === "career") {
    const roleTitle = input.jobTitle?.trim() || "the role";
    const received = `${input.hasCv ? "your CV / resume" : "your candidature"}${input.hasCoverLetter ? " and cover letter" : ""}`;
    subject = `We received your application for ${roleTitle} — QASyn`;
    heading = "Application received";
    bodyHtml = `<p>Dear ${safeName},</p><p>Thank you for applying for <strong>${escapeHtml(roleTitle)}</strong> at QASyn. We have received ${received}.</p><p>Our engineering and hiring team is reviewing your application. If your profile and experience match our criteria, we will contact you directly to schedule the next steps.</p>`;
    bodyText = `Dear ${name},\n\nThank you for applying for ${roleTitle} at QASyn. We have received ${received}.\n\nOur engineering and hiring team is reviewing your application. If your profile and experience match our criteria, we will contact you directly to schedule the next steps.`;
  } else if (input.kind === "demo") {
    subject = "Your QASyn personalized demo request is confirmed";
    heading = "Your demo request is confirmed";
    bodyHtml = `<p>Dear ${safeName},</p><p>Thank you for booking a personalized QASyn walkthrough${input.company ? ` for <strong>${escapeHtml(input.company)}</strong>` : ""}. We have received your request and a QASyn Solutions Architect will reach out within one business day to schedule the 30-minute session.</p>${input.message ? `<p style="margin-top:16px;padding:12px;background:#f8fafc;border-radius:8px;color:#475569"><strong>Your request:</strong><br/>${escapeHtml(input.message).replace(/\n/g, "<br/>")}</p>` : ""}`;
    bodyText = `Dear ${name},\n\nThank you for booking a personalized QASyn walkthrough${input.company ? ` for ${input.company}` : ""}. We have received your request and a QASyn Solutions Architect will reach out within one business day to schedule the 30-minute session.${input.message ? `\n\nYour request:\n${input.message}` : ""}`;
  } else {
    subject = "We received your message — QASyn Support & Sales";
    heading = "Message received";
    bodyHtml = `<p>Dear ${safeName},</p><p>Thank you for contacting QASyn. Our team has received your inquiry and will reply within one business day.</p>${input.message ? `<p style="margin-top:16px;padding:12px;background:#f8fafc;border-radius:8px;color:#475569"><strong>Your message:</strong><br/>${escapeHtml(input.message).replace(/\n/g, "<br/>")}</p>` : ""}`;
    bodyText = `Dear ${name},\n\nThank you for contacting QASyn. Our team has received your inquiry and will reply within one business day.${input.message ? `\n\nYour message:\n${input.message}` : ""}`;
  }

  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:620px;margin:auto;padding:24px"><h2>${heading}</h2>${bodyHtml}<p style="margin-top:24px">Kind regards,<br/><strong>QASyn Team</strong></p><p style="color:#6b7280;font-size:12px;margin-top:24px">QASyn · Autonomous Quality Engineering</p></div>`;
  const text = `${bodyText}\n\nKind regards,\nQASyn Team\n\nQASyn · Autonomous Quality Engineering`;
  return sendMail({
    to: input.email,
    subject,
    html,
    text,
    replyTo: '"QASyn Team" <info@qasyn.io>',
  });
}

export async function sendInvitationEmail(email: string, inviteUrl: string, organisationName: string, role: string): Promise<void> {
  await sendMail({
    to: email,
    subject: `You are invited to ${organisationName} on QASyn`,
    html: `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;padding:24px"><h2>Join ${organisationName} on QASyn</h2><p>You have been invited as <strong>${role}</strong>.</p><p><a href="${inviteUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600">Accept invitation</a></p><p>Or paste this link into your browser:<br/><span style="word-break:break-all">${inviteUrl}</span></p><p style="color:#6b7280;font-size:12px">This invitation expires in 7 days.</p></div>`,
    text: `You are invited to ${organisationName} on QASyn as ${role}. Accept: ${inviteUrl}`,
  });
}
