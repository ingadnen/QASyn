// Server-only module (node:crypto).
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

/** scrypt password hash: "scrypt$<salt b64>$<hash b64>". */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scryptAsync(password, Buffer.from(saltB64, "base64"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** 6-digit e-mail verification code. */
export const verificationCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

/** Simulated localhost tunnel token, e.g. "tnl_BzB-1fS…". */
export const generateTunnelToken = () => `tnl_${randomBytes(18).toString("base64url")}`;

/** API token "cqa_…" — shown once, only its SHA-256 is stored. */
export function generateApiToken() {
  const token = `cqa_${randomBytes(24).toString("base64url")}`;
  return { token, prefix: token.slice(0, 10), hash: sha256(token) };
}

function secretKey(): Buffer {
  const secret = process.env.QASYN_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("QASYN_SECRET must be set in production.");
  }
  return createHash("sha256").update(secret ?? "qasyn-local-dev-secret").digest();
}

/** AES-256-GCM encryption for stored app test credentials. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

export function decryptSecret(payload: string): string | null {
  try {
    const [version, iv, tag, data] = payload.split(":");
    if (version !== "v1" || !iv || !tag || !data) return null;
    const decipher = createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
