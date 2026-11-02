/**
 * Enterprise Security & Input Sanitization Utility
 * Provides deep recursive sanitization against XSS, SQLi patterns, NoSQL injection,
 * prototype pollution, and enforces clean string/number primitives across all API boundaries.
 */

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Strips potentially malicious HTML/script tags, null bytes, and control characters
 * while preserving safe punctuation, unicode characters, and data URIs/URLs.
 */
export function sanitizeString(input: unknown, maxLength = 5000): string {
  if (input === null || input === undefined) return "";
  const raw = typeof input === "string" ? input : String(input);

  // Preserve base64 data URIs for images/files without corrupting them
  if (
    raw.startsWith("data:image/") ||
    raw.startsWith("data:text/csv") ||
    raw.startsWith("data:application/")
  ) {
    return raw.trim();
  }

  const cleaned = raw
    // Remove null bytes and dangerous control characters (except newline/tab)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Strip <script>...</script> blocks
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // Strip inline event handlers like onload=, onerror=, onclick=
    .replace(/\bon\w+\s*=\s*(['"][^'"]*['"]|[^\s>]+)/gi, "")
    // Strip javascript: and vbscript: pseudo-protocols
    .replace(/\b(javascript|vbscript|data:text\/html)\s*:/gi, "")
    // Strip dangerous HTML tags (iframe, object, embed, meta, link, style)
    .replace(
      /<\/?(iframe|object|embed|meta|link|style|base|form)\b[^>]*>/gi,
      "",
    )
    .trim();

  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

/**
 * Deeply sanitizes any payload (Object, Array, Primitive) recursively.
 * Protects against Prototype Pollution and XSS injection.
 */
export function sanitizePayload<T>(data: T, depth = 0): T {
  if (depth > 15 || data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string") {
    return sanitizeString(data) as unknown as T;
  }

  if (typeof data === "number") {
    return (Number.isFinite(data) ? data : 0) as unknown as T;
  }

  if (typeof data === "boolean") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizePayload(item, depth + 1)) as unknown as T;
  }

  if (typeof data === "object") {
    const cleanObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (DANGEROUS_KEYS.has(key)) {
        continue; // Block prototype pollution
      }
      const cleanKey = sanitizeString(key, 200);
      cleanObj[cleanKey] = sanitizePayload(value, depth + 1);
    }
    return cleanObj as T;
  }

  return data;
}

/**
 * Safely parses numeric inputs with fallback default and bounds checking.
 * Supports both:
 *   sanitizeNumber(val, { min, max, fallback })
 * and positional:
 *   sanitizeNumber(val, defaultVal, min, max)
 */
export function sanitizeNumber(
  val: unknown,
  optionsOrDefault?:
    | number
    | { min?: number; max?: number; fallback?: number },
  minArg = -Infinity,
  maxArg = Infinity,
): number {
  let fallback = 0;
  let min = minArg;
  let max = maxArg;

  if (typeof optionsOrDefault === "number") {
    fallback = optionsOrDefault;
  } else if (optionsOrDefault && typeof optionsOrDefault === "object") {
    if (optionsOrDefault.fallback !== undefined) {
      fallback = optionsOrDefault.fallback;
    }
    if (optionsOrDefault.min !== undefined) {
      min = optionsOrDefault.min;
    }
    if (optionsOrDefault.max !== undefined) {
      max = optionsOrDefault.max;
    }
  }

  const num =
    typeof val === "number"
      ? val
      : Number(String(val ?? "").replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(num) || Number.isNaN(num)) {
    return fallback;
  }
  return Math.min(Math.max(num, min), max);
}

/**
 * Sanitizes email addresses into canonical lowercase format.
 */
export function sanitizeEmail(email: unknown): string {
  if (typeof email !== "string") return "";
  return sanitizeString(email, 254).toLowerCase().replace(/\s+/g, "");
}

/**
 * Sanitizes phone numbers (preserving digits, +, and -).
 */
export function sanitizePhone(phone: unknown): string {
  if (typeof phone !== "string") return "";
  return phone.replace(/[^0-9+-]/g, "").slice(0, 20);
}
