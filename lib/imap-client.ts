import tls from "node:tls";

export interface ImapMessage {
  seq: number;
  subject: string;
  from: string;
  replyTo: string;
  to: string;
  date: string;
  snippet: string;
}

export interface ImapOptions {
  host: string;
  port?: number;
  user: string;
  pass: string;
  limit?: number;
  timeoutMs?: number;
}

function quoteImap(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

function bufferText(buffer: Buffer, charset: string): string {
  const normalized = charset.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized === "iso88591" || normalized === "latin1") return buffer.toString("latin1");
  if (normalized === "usascii" || normalized === "ascii") return buffer.toString("ascii");
  if (normalized === "utf16le" || normalized === "utf16") return buffer.toString("utf16le");
  return buffer.toString("utf8");
}

/** Decodes RFC 2047 encoded-words (B and Q variants) in headers. */
function decodeMimeHeader(value: string): string {
  if (!value) return value;
  return value
    .replace(/(\?=)\s+(=\?)/g, "$1$2")
    .replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_match, charset: string, encoding: string, encoded: string) => {
      try {
        if (encoding.toUpperCase() === "B") {
          return bufferText(Buffer.from(encoded, "base64"), charset);
        }
        const source = encoded.replace(/_/g, " ");
        const bytes: number[] = [];
        let result = "";
        for (let index = 0; index < source.length; index++) {
          if (source[index] === "=" && /^[0-9A-Fa-f]{2}$/.test(source.slice(index + 1, index + 3))) {
            bytes.push(Number.parseInt(source.slice(index + 1, index + 3), 16));
            index += 2;
          } else {
            if (bytes.length > 0) {
              result += bufferText(Buffer.from(bytes), charset);
              bytes.length = 0;
            }
            result += source[index];
          }
        }
        if (bytes.length > 0) result += bufferText(Buffer.from(bytes), charset);
        return result;
      } catch {
        return encoded;
      }
    });
}

function decodeQuotedPrintable(value: string): string {
  const source = value.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  let result = "";
  for (let index = 0; index < source.length; index++) {
    if (source[index] === "=" && /^[0-9A-Fa-f]{2}$/.test(source.slice(index + 1, index + 3))) {
      bytes.push(Number.parseInt(source.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      if (bytes.length > 0) {
        result += Buffer.from(bytes).toString("utf8");
        bytes.length = 0;
      }
      result += source[index];
    }
  }
  if (bytes.length > 0) result += Buffer.from(bytes).toString("utf8");
  return result;
}

function stripHtml(value: string): string {
  const protectedEmails: string[] = [];
  const withPlaceholders = value.replace(/<([^<>\s]+@[^<>\s]+)>/g, (match) => {
    const token = `__QASYN_EMAIL_${protectedEmails.length}__`;
    protectedEmails.push(match);
    return token;
  });
  const stripped = withPlaceholders
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/?[a-zA-Z][^>]*>/g, " ");
  return decodeEntities(stripped)
    .replace(/__QASYN_EMAIL_(\d+)__/g, (_match, index: string) => protectedEmails[Number(index)] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeaderBlock(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]+/g, " ");
}

function extractMimeText(raw: string): string {
  const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const boundaryMatch = /^--([^\n-][^\n]*?)\s*$/m.exec(text);
  if (boundaryMatch) {
    const boundary = boundaryMatch[1].trim();
    const parts = text.split(new RegExp(`^--${boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:--)?\\s*$`, "m"));
    let htmlPart = "";
    let plainPart = "";
    for (const part of parts) {
      const separator = part.indexOf("\n\n");
      if (separator < 0) continue;
      const headers = normalizeHeaderBlock(part.slice(0, separator)).toLowerCase();
      if (!headers.includes("content-type:")) continue;
      if (headers.includes("content-disposition: attachment")) continue;
      if (headers.includes("content-transfer-encoding: base64")) continue;
      let body = part.slice(separator + 2);
      if (headers.includes("content-transfer-encoding: quoted-printable")) body = decodeQuotedPrintable(body);
      if (headers.includes("content-type: text/html") && !htmlPart) htmlPart = body;
      else if (headers.includes("content-type: text/plain") && !plainPart) plainPart = body;
    }
    if (htmlPart) return stripHtml(htmlPart);
    if (plainPart) return decodeEntities(plainPart).replace(/\s+/g, " ").trim();
  }

  const separator = text.indexOf("\n\n");
  if (separator > 0) {
    const headers = normalizeHeaderBlock(text.slice(0, separator)).toLowerCase();
    if (headers.includes("content-type:") && !headers.includes("content-disposition: attachment") && !headers.includes("content-transfer-encoding: base64")) {
      let body = text.slice(separator + 2);
      if (headers.includes("content-transfer-encoding: quoted-printable")) body = decodeQuotedPrintable(body);
      if (headers.includes("content-type: text/html")) return stripHtml(body);
      if (headers.includes("content-type: text/plain")) return decodeEntities(body).replace(/\s+/g, " ").trim();
    }
  }

  return stripHtml(text);
}

/** Minimal recursive parser for IMAP parenthesised values and quoted strings. */
function parseImapValue(input: string, start: number): { value: unknown; next: number } {
  let index = start;
  const skip = () => {
    while (index < input.length && /[ \r\n]/.test(input[index])) index++;
  };
  skip();
  if (input[index] === "(") {
    index++;
    const list: unknown[] = [];
    while (index < input.length) {
      skip();
      if (input[index] === ")") {
        index++;
        return { value: list, next: index };
      }
      const parsed = parseImapValue(input, index);
      list.push(parsed.value);
      index = parsed.next;
    }
    return { value: list, next: index };
  }
  if (input[index] === '"') {
    index++;
    let value = "";
    while (index < input.length) {
      const character = input[index];
      if (character === "\\") {
        value += input[index + 1] ?? "";
        index += 2;
        continue;
      }
      if (character === '"') {
        index++;
        break;
      }
      value += character;
      index++;
    }
    return { value, next: index };
  }
  if (input.slice(index, index + 3).toUpperCase() === "NIL") {
    return { value: null, next: index + 3 };
  }
  if (input[index] === "{") {
    const end = input.indexOf("}", index);
    if (end < 0) return { value: "", next: input.length };
    const length = Number(input.slice(index + 1, end));
    const literalStart = input.indexOf("\r\n", end) + 2;
    const value = input.slice(literalStart, literalStart + length);
    return { value, next: literalStart + length };
  }
  let value = "";
  while (index < input.length && !/[ ()\r\n]/.test(input[index])) {
    value += input[index];
    index++;
  }
  return { value, next: index };
}

export function formatImapAddressList(list: unknown): string {
  if (!Array.isArray(list)) return "";
  return list
    .map((item) => {
      if (!Array.isArray(item)) return "";
      const name = typeof item[0] === "string" ? decodeMimeHeader(item[0]) : "";
      const mailbox = typeof item[2] === "string" ? item[2] : "";
      const host = typeof item[3] === "string" ? item[3] : "";
      const email = mailbox && host ? `${mailbox}@${host}` : mailbox || host;
      if (!email) return name;
      return name ? `${name} <${email}>` : email;
    })
    .filter(Boolean)
    .join(", ");
}

function emailAddress(value: string): string {
  return (/<([^>]+)>/.exec(value)?.[1] || value).trim();
}

function parseEnvelope(block: string): { subject: string; from: string; replyTo: string; to: string; date: string } {
  const marker = block.indexOf("ENVELOPE (");
  if (marker < 0) return { subject: "(no subject)", from: "", replyTo: "", to: "", date: "" };
  const parsed = parseImapValue(block, marker + "ENVELOPE ".length);
  if (!Array.isArray(parsed.value)) return { subject: "(no subject)", from: "", replyTo: "", to: "", date: "" };
  const envelope = parsed.value as unknown[];
  const date = typeof envelope[0] === "string" ? envelope[0] : "";
  const subject = typeof envelope[1] === "string" ? decodeMimeHeader(envelope[1]) : "(no subject)";
  const from = formatImapAddressList(envelope[2]);
  const replyTo = formatImapAddressList(envelope[4]);
  const to = formatImapAddressList(envelope[5]);
  return {
    subject,
    from: decodeMimeHeader(from),
    replyTo: decodeMimeHeader(replyTo),
    to: decodeMimeHeader(to),
    date,
  };
}

function extractSnippet(block: string): string {
  const literal = /BODY\[TEXT\][^\r\n]*\{(\d+)\}\r\n/.exec(block);
  if (literal) {
    const start = literal.index + literal[0].length;
    return extractMimeText(block.slice(start, start + Number(literal[1]))).slice(0, 500);
  }
  const quoted = /BODY\[TEXT\][^\r\n]*"((?:[^"\\]|\\.)*)"/.exec(block);
  return quoted ? extractMimeText(quoted[1]).slice(0, 500) : "";
}

/**
 * Parses one FETCH block into a message. Exported so parity tests can verify
 * reply-to resolution without a live IMAP server.
 */
export function parseImapMessageBlock(block: string, platformMailbox = ""): Omit<ImapMessage, "seq"> {
  const envelope = parseEnvelope(block);
  const snippet = extractSnippet(block);
  const platform = platformMailbox.trim().toLowerCase();
  const replyEmail = emailAddress(envelope.replyTo).toLowerCase();
  const leadEmail = /\bEmail\s+([^\s<>]+@[^\s<>]+)/i.exec(snippet)?.[1];
  const replyTo =
    (!replyEmail || replyEmail === platform) && leadEmail ? leadEmail : envelope.replyTo;
  return { ...envelope, replyTo, snippet };
}

function splitFetchBlocks(response: string): Array<{ seq: number; block: string }> {
  const matches = [...response.matchAll(/^\* (\d+) FETCH \(/gm)];
  return matches.map((match, index) => ({
    seq: Number(match[1]),
    block: response.slice(match.index ?? 0, matches[index + 1]?.index ?? response.length),
  }));
}

/**
 * Zero-dependency IMAPS client. It only reads the latest messages from INBOX
 * and never mutates the mailbox (EXAMINE + BODY.PEEK).
 */
export async function fetchLatestImapMessages(options: ImapOptions): Promise<ImapMessage[]> {
  const host = options.host.trim();
  const port = options.port ?? 993;
  const user = options.user.trim();
  const pass = options.pass;
  const limit = Math.min(Math.max(options.limit ?? 15, 1), 50);
  if (!host || !user || !pass) {
    throw new Error("IMAP is not configured. Set the SMTP host, username and password in the Super Admin email settings.");
  }

  const socket = tls.connect({ host, port, servername: host });
  let buffer = "";
  let tagCounter = 0;
  let failure: Error | null = null;
  let waiters: Array<{ match: (value: string) => string | null; resolve: (value: string) => void; reject: (error: Error) => void }> = [];

  const checkWaiters = () => {
    for (let index = waiters.length - 1; index >= 0; index--) {
      const waiter = waiters[index];
      const result = waiter.match(buffer);
      if (result !== null) {
        waiters.splice(index, 1);
        waiter.resolve(result);
      }
    }
  };

  const onData = (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    checkWaiters();
  };
  const onError = (error: Error) => {
    failure = error;
    for (const waiter of waiters) waiter.reject(error);
    waiters = [];
  };
  const onClose = () => {
    if (waiters.length === 0) return;
    const error = new Error("IMAP connection closed unexpectedly.");
    for (const waiter of waiters) waiter.reject(error);
    waiters = [];
  };

  socket.on("data", onData);
  socket.on("error", onError);
  socket.on("close", onClose);
  socket.setTimeout(options.timeoutMs ?? 15_000, () => {
    socket.destroy(new Error("IMAP connection timed out."));
  });

  const waitFor = (match: (value: string) => string | null): Promise<string> =>
    new Promise((resolve, reject) => {
      if (failure) {
        reject(failure);
        return;
      }
      waiters.push({ match, resolve, reject });
      checkWaiters();
    });

  const command = async (commandText: string): Promise<string> => {
    const tag = `q${++tagCounter}`;
    socket.write(`${tag} ${commandText}\r\n`);
    const response = await waitFor((value) => {
      const tagged = new RegExp(`(?:^|\\r\\n)${tag} (?:OK|NO|BAD)`, "m");
      if (tagged.test(value)) return value;
      if (/^\* BYE/m.test(value)) return value;
      return null;
    });
    buffer = "";
    if (!new RegExp(`(?:^|\\r\\n)${tag} OK`, "m").test(response)) {
      throw new Error(`IMAP ${commandText.split(" ")[0]} failed: ${response.slice(-300)}`);
    }
    return response;
  };

  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("secureConnect", resolve);
      socket.once("error", reject);
    });

    const greeting = await waitFor((value) => (/^\* (?:OK|PREAUTH|BYE)/m.test(value) ? value : null));
    buffer = "";
    if (/^\* BYE/m.test(greeting)) throw new Error("IMAP server refused the connection.");

    try {
      await command(`LOGIN ${quoteImap(user)} ${quoteImap(pass)}`);
    } catch {
      const tag = `q${++tagCounter}`;
      socket.write(`${tag} AUTHENTICATE PLAIN\r\n`);
      await waitFor((value) => (/^\+/m.test(value) ? value : null));
      buffer = "";
      socket.write(`${Buffer.from(`\0${user}\0${pass}`, "utf8").toString("base64")}\r\n`);
      const auth = await waitFor((value) => {
        const tagged = new RegExp(`(?:^|\\r\\n)${tag} (?:OK|NO|BAD)`, "m");
        return tagged.test(value) ? value : null;
      });
      buffer = "";
      if (!new RegExp(`(?:^|\\r\\n)${tag} OK`, "m").test(auth)) {
        throw new Error("IMAP authentication failed. Check the mailbox username and password.");
      }
    }

    const examine = await command("EXAMINE INBOX");
    const exists = /^\* (\d+) EXISTS/m.exec(examine);
    const total = exists ? Number(exists[1]) : 0;
    if (total === 0) {
      await command("LOGOUT").catch(() => undefined);
      return [];
    }

    const start = Math.max(1, total - limit + 1);
    const fetchResponse = await command(`FETCH ${start}:${total} (ENVELOPE BODY.PEEK[TEXT]<0.4096>)`);
    const messages = splitFetchBlocks(fetchResponse).map(({ seq, block }) => ({
      seq,
      ...parseImapMessageBlock(block, user),
    }));
    await command("LOGOUT").catch(() => undefined);
    return messages.sort((left, right) => right.seq - left.seq);
  } finally {
    socket.removeAllListeners("data");
    socket.removeAllListeners("error");
    socket.removeAllListeners("close");
    socket.end();
    socket.destroy();
  }
}
