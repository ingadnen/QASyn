import net from "node:net";
import path from "node:path";
import tls from "node:tls";
import { appendFile, mkdir } from "node:fs/promises";
import { prisma } from "./db";

export const CONTACT_RECIPIENT_EMAIL = process.env.CONTACT_RECIPIENT_EMAIL || "adnen.rebhi@qasyn.com";

type MailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

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

async function sendSmtp(input: MailInput): Promise<void> {
  const host = String(process.env.SMTP_HOST ?? "").trim();
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = String(process.env.SMTP_USER ?? "").trim();
  const pass = String(process.env.SMTP_PASS ?? "").trim();
  const from = String(process.env.SMTP_FROM ?? "QASyn <no-reply@qasyn.com>").trim();
  if (!host) throw new Error("SMTP_HOST is not configured.");

  const secure = port === 465 || String(process.env.SMTP_SECURE ?? "").toLowerCase() === "true";
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
      const auth = await smtpCommand(socket, "AUTH LOGIN");
      if (auth.code !== 334) throw new Error(`SMTP AUTH rejected: ${auth.text}`);
      await smtpCommand(socket, Buffer.from(user).toString("base64"));
      await smtpCommand(socket, Buffer.from(pass).toString("base64"));
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
      'Content-Type: text/html; charset="UTF-8"',
    ];
    const body = input.html.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
    const message = `${headers.join("\r\n")}\r\n\r\n${body}`;
    socket.write(`${message}\r\n.\r\n`);
    const accepted = await readSmtpResponse(socket);
    if (accepted.code >= 400) throw new Error(`SMTP message rejected: ${accepted.text}`);
    await smtpCommand(socket, "QUIT").catch(() => undefined);
  } finally {
    socket.end();
    socket.destroy();
  }
}

async function sendResend(input: MailInput): Promise<void> {
  const key = String(process.env.RESEND_API_KEY ?? "").trim();
  if (!key) throw new Error("RESEND_API_KEY is not configured.");
  const clean = (value: string) => value.replace(/[\r\n]+/g, " ").trim();
  const from = clean(String(process.env.RESEND_FROM ?? "QASyn <no-reply@qasyn.com>").trim());
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
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend rejected the message (${response.status}): ${body.slice(0, 220)}`);
  }
}

/** Sends an email via SMTP, Resend, or the persistent SQLite outbox fallback. */
export async function sendMail(input: MailInput): Promise<{ provider: "smtp" | "resend" | "outbox"; status: "sent" | "queued" | "failed" }> {
  const text = input.text ?? input.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  let provider: "smtp" | "resend" | "outbox" = "outbox";
  let status: "sent" | "queued" | "failed" = "queued";
  let error: string | null = null;
  try {
    if (process.env.SMTP_HOST) {
      provider = "smtp";
      await sendSmtp(input);
      status = "sent";
    } else if (process.env.RESEND_API_KEY) {
      provider = "resend";
      await sendResend(input);
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
}): Promise<{ provider: "smtp" | "resend" | "outbox"; status: "sent" | "queued" | "failed" }> {
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
  ];
  const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:auto;padding:24px"><h2>QASyn ${escapeHtml(label)}</h2><table style="border-collapse:collapse;width:100%">${rows
    .map(([key, value]) => `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;vertical-align:top">${escapeHtml(key)}</td><td style="padding:6px 0;color:#111827;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`)
    .join("")}</table><p style="color:#6b7280;font-size:12px;margin-top:24px">Sent to ${escapeHtml(CONTACT_RECIPIENT_EMAIL)} by the QASyn marketing site.</p></div>`;
  const text = [`QASyn ${label}`, ...rows.map(([key, value]) => `${key}: ${value}`), `Recipient: ${CONTACT_RECIPIENT_EMAIL}`].join("\n");
  const safeName = input.name.replace(/["\\\r\n]+/g, " ").trim() || "QASyn Lead";
  const subjectSuffix = input.kind === "contact" && input.source ? ` · ${input.source}` : "";
  const result = await sendMail({
    to: CONTACT_RECIPIENT_EMAIL,
    subject: `QASyn ${label}: ${input.name}${subjectSuffix}`,
    html,
    text,
    replyTo: `"${safeName}" <${input.email}>`,
  });
  try {
    const logDir = path.join(process.cwd(), ".qasyn-data");
    await mkdir(logDir, { recursive: true });
    await appendFile(
      path.join(logDir, "mail.log"),
      `${JSON.stringify({ at: new Date().toISOString(), kind: input.kind, name: input.name, email: input.email, to: CONTACT_RECIPIENT_EMAIL, provider: result.provider, status: result.status })}\n`,
      "utf8",
    );
  } catch (error) {
    console.warn("[mailer] lead notification log skipped", error instanceof Error ? error.message : String(error));
  }
  return result;
}

export async function sendInvitationEmail(email: string, inviteUrl: string, organisationName: string, role: string): Promise<void> {
  await sendMail({
    to: email,
    subject: `You are invited to ${organisationName} on QASyn`,
    html: `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;padding:24px"><h2>Join ${organisationName} on QASyn</h2><p>You have been invited as <strong>${role}</strong>.</p><p><a href="${inviteUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600">Accept invitation</a></p><p>Or paste this link into your browser:<br/><span style="word-break:break-all">${inviteUrl}</span></p><p style="color:#6b7280;font-size:12px">This invitation expires in 7 days.</p></div>`,
    text: `You are invited to ${organisationName} on QASyn as ${role}. Accept: ${inviteUrl}`,
  });
}
