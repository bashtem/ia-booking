import { defineConfig } from "drizzle-kit";
import { loadEnvFileIfPresent } from "./src/config/env.ts";

loadEnvFileIfPresent();

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl === undefined || databaseUrl.length === 0) {
  throw new Error("DATABASE_URL is required to run Drizzle Kit");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
});
