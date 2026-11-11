/**
 * Bounding-box normalisation for Articul8 Bivia /ground.
 *
 * The overlay renders on a fixed 0–1000 canvas, but models return boxes in
 * three different coordinate spaces: normalized 0–1, Qwen-style 0–1000 milli
 * pixels, or raw pixels. Keeping this pure module free of Next/Prisma imports
 * lets both the server route and the parity verifier test every space.
 */
export interface NormalisedBox {
  /** Normalised coordinates in a 0–1000 canvas (overlay-friendly). */
  x: number;
  y: number;
  width: number;
  height: number;
  rawBox: [number, number, number, number];
  space: "normalized" | "milli" | "pixels";
}

const NOMINAL_VIEWPORT = { width: 1280, height: 720 } as const;

function clampBox(value: number, max: number): number {
  return Math.round(Math.min(max, Math.max(0, value)) * 10) / 10;
}

/**
 * Normalises a model box into a stable 0–1000 canvas while keeping the original
 * corner coordinates for the floating badge.
 *
 *  - `[0..1]` coordinates are treated as normalized.
 *  - `[0..1000]` coordinates are treated as milli-pixels (Qwen-style).
 *  - anything larger is treated as pixels on the supplied (or nominal) viewport.
 *  - `[x, y, w, h]` payloads with an inverted corner are also accepted.
 */
export function normalizeGroundBox(
  raw: number[],
  viewport: { width: number; height: number } = NOMINAL_VIEWPORT,
): NormalisedBox {
  const [a, b, c, d] = raw.map(Number);
  const rawBox: [number, number, number, number] = [a, b, c, d];
  const safeA = Number.isFinite(a) ? a : 0;
  const safeB = Number.isFinite(b) ? b : 0;
  const safeC = Number.isFinite(c) ? c : 0;
  const safeD = Number.isFinite(d) ? d : 0;
  // Corner format [x1,y1,x2,y2] unless inverted, then [x,y,w,h].
  const x1 = Math.min(safeA, safeC);
  const y1 = Math.min(safeB, safeD);
  const x2 = safeC > safeA ? safeC : safeA + Math.max(0, safeC);
  const y2 = safeD > safeB ? safeD : safeB + Math.max(0, safeD);
  const magnitude = Math.max(Math.abs(x1), Math.abs(y1), Math.abs(x2), Math.abs(y2));

  let scaleX = 1;
  let scaleY = 1;
  let space: NormalisedBox["space"] = "milli";
  if (magnitude <= 1.5) {
    scaleX = 1000;
    scaleY = 1000;
    space = "normalized";
  } else if (magnitude > 1000) {
    const width = viewport.width > 0 ? viewport.width : NOMINAL_VIEWPORT.width;
    const height = viewport.height > 0 ? viewport.height : NOMINAL_VIEWPORT.height;
    scaleX = 1000 / width;
    scaleY = 1000 / height;
    space = "pixels";
  }

  const nx1 = clampBox(x1 * scaleX, 1000);
  const ny1 = clampBox(y1 * scaleY, 1000);
  const nx2 = clampBox(x2 * scaleX, 1000);
  const ny2 = clampBox(y2 * scaleY, 1000);
  return {
    x: Math.min(nx1, nx2),
    y: Math.min(ny1, ny2),
    width: Math.max(0, Math.abs(nx2 - nx1)),
    height: Math.max(0, Math.abs(ny2 - ny1)),
    rawBox,
    space,
  };
}
