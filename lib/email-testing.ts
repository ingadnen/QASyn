/**
 * Email testing engine: virtual inboxes, OTP and magic-link extraction.
 * Simulated delivery — no outbound mail is ever sent.
 */
export function generateInboxAddress(label: string): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "test";
  const rand = Math.random().toString(36).slice(2, 8);
  return `${slug}-${rand}@inbox.qasyn.local`;
}

export function extractOtp(bodyText: string): string | null {
  const match = /(?:code|otp|verification)[^\d]{0,30}(\d{4,8})/i.exec(bodyText) ?? /\b(\d{6})\b/.exec(bodyText);
  return match?.[1] ?? null;
}

export function extractLinks(bodyHtml: string): string[] {
  const links = [...bodyHtml.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]);
  return [...new Set(links)].slice(0, 20);
}

export function simulateVerificationEmail(inbox: string, subject: string, withOtp = true): { bodyText: string; bodyHtml: string } {
  const otp = withOtp ? String(Math.floor(100000 + Math.random() * 900000)) : "";
  return {
    bodyText: `Hello,\n\nYour verification code is ${otp}. It expires in 10 minutes.\n\nConfirm here: https://app.qasyn.local/verify?token=magic-${otp}`,
    bodyHtml: `<p>Hello ${inbox},</p><p>Your verification code is <strong>${otp}</strong>.</p><a href="https://app.qasyn.local/verify?token=magic-${otp}">Verify</a>`,
  };
}
