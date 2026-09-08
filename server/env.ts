import dotenv from "dotenv";
dotenv.config({ override: true });
import { z } from "zod";
import { logger } from "./logger.js";

// Provide fallbacks for required env vars to prevent startup crashes
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET =
    "ledgerline_super_secret_stable_key_for_production_fallback_32_chars";
  logger.warn(
    "[ENV] JWT_SECRET is missing or too short. Using a fallback secret.",
  );
}

if (!process.env.DEFAULT_OWNER_PASSWORD) {
  process.env.DEFAULT_OWNER_PASSWORD = "password";
}

if (!process.env.SUPERADMIN_EMAIL) {
  process.env.SUPERADMIN_EMAIL = "admin@ledgerline.local";
}

if (!process.env.SUPERADMIN_PASSWORD) {
  process.env.SUPERADMIN_PASSWORD = "password";
}

const isInvalidDbUrl =
  !process.env.DATABASE_URL ||
  (!process.env.DATABASE_URL.startsWith("postgres://") &&
    !process.env.DATABASE_URL.startsWith("postgresql://"));

if (isInvalidDbUrl) {
  logger.error(
    "[ENV] DATABASE_URL is missing or invalid. It must start with postgresql:// or postgres://. Using dummy URL to allow server start, but database connection will fail.",
  );
  process.env.DATABASE_URL = "postgresql://dummy:dummy@localhost:5432/dummy";
}

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DEFAULT_OWNER_PASSWORD: z
    .string()
    .min(1, "DEFAULT_OWNER_PASSWORD is required"),
  SUPERADMIN_EMAIL: z.string().email(),
  SUPERADMIN_PASSWORD: z.string().min(1, "SUPERADMIN_PASSWORD is required"),
  CORS_ORIGIN: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  BREVO_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  MIDTRANS_SERVER_KEY: z.string().optional(),
  MIDTRANS_CLIENT_KEY: z.string().optional(),
  MIDTRANS_IS_PRODUCTION: z.coerce.boolean().default(false),
  REDIS_URL: z.string().optional(), // For Redis cache
});

let env: z.infer<typeof envSchema>;

try {
  env = envSchema.parse(process.env);

  if (!env.GEMINI_API_KEY) {
    logger.warn("[ENV] GEMINI_API_KEY is not set. AI features might not work.");
  }
  if (!env.BREVO_API_KEY) {
    logger.warn(
      "[ENV] BREVO_API_KEY is not set. Email notifications will be skipped.",
    );
  }
} catch (err: any) {
  if (err instanceof z.ZodError) {
    logger.error("[ENV] Environment validation failed:");
    for (const error of err.issues) {
      logger.error(`  - ${error.path.join(".")}: ${error.message}`);
    }
  }

  if (process.env.NODE_ENV === "test") {
    // In test environment, provide fallback to avoid crashing tests immediately
    env = {
      NODE_ENV: "test",
      JWT_SECRET: "ledgerline_super_secret_stable_key_for_development_32_chars",
      DATABASE_URL: "postgresql://dummy:dummy@localhost:5432/dummy",
      DEFAULT_OWNER_PASSWORD: "password",
      SUPERADMIN_EMAIL: "admin@ledgerline.local",
      SUPERADMIN_PASSWORD: "password",
      CORS_ORIGIN: "*",
      MIDTRANS_IS_PRODUCTION: false,
    };
  } else {
    logger.error(
      "[ENV] Server tidak bisa start karena konfigurasi environment tidak valid. Perbaiki variabel di atas lalu deploy ulang.",
    );
    process.exit(1);
  }
}

export { env };
