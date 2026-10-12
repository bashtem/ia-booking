import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { z } from "zod";

const developmentDatabaseUrl = "postgres://ia:ia@localhost:5432/ia_booking";

const postgresUrl = z.string().refine((value) => {
  try {
    const url = new URL(value);
    const database = url.pathname.replace(/^\//, "");
    return (
      (url.protocol === "postgres:" || url.protocol === "postgresql:") &&
      url.hostname.length > 0 &&
      database.length > 0
    );
  } catch {
    return false;
  }
}, "must be a postgres connection URL");

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    HOST: z.string().min(1).default("0.0.0.0"),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    CORS_ORIGIN: z.string().default(""),
    DATABASE_URL: postgresUrl.optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "development" && env.DATABASE_URL === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "DATABASE_URL is required",
      });
    }
  })
  .transform((env) => ({
    ...env,
    DATABASE_URL: env.DATABASE_URL ?? developmentDatabaseUrl,
  }));

export type Env = z.infer<typeof envSchema>;

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

// Reads `.env` from the working directory. Variables already set in the
// environment are left unchanged, matching `node --env-file-if-exists`.
export function loadEnvFileIfPresent(): void {
  try {
    loadEnvFile(resolve(".env"));
  } catch (error) {
    if (!isMissingFile(error)) {
      throw error;
    }
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (source === process.env) {
    loadEnvFileIfPresent();
  }

  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return parsed.data;
}
