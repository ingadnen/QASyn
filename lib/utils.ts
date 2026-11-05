/** Utilitaires purs, utilisables côté client et serveur. */

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** "Gmailad Inc." → "gmailad-inc" */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 40 && SLUG_PATTERN.test(slug);
}

/**
 * Normalise une URL saisie ("gmail.com" → "https://gmail.com").
 * Retourne null si l'URL est invalide ou n'utilise pas http(s).
 */
export function normalizeWebsite(input: string): string | null {
  const raw = input.trim();
  if (!raw || raw.length > 300) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
    const path = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
    return `${url.protocol}//${url.host}${path}`;
  } catch {
    return null;
  }
}

export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

/** "tnl_BzB-1fSxyz…" → "tnl_BzB-1fS••••••••••" */
export function maskToken(token: string, visible = 11): string {
  return token.length <= visible ? token : `${token.slice(0, visible)}${"•".repeat(10)}`;
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatUsdCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (value: string) => value.length <= 254 && EMAIL_PATTERN.test(value);
