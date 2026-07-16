import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { D1Database } from "@cloudflare/workers-types";
import { admin, anonymous } from "better-auth/plugins";
import { getDb } from "@/db";
import * as schema from "@/db/schema";

export const drizzleConfig = {
  emailAndPassword: {
    enabled: true,
  },
  // `anonymous()` lets guests join a room (sing-along) before creating a
  // real account — adds `isAnonymous` to the `user` table (see
  // app/db/schema.ts). Hosting a room still requires a real account
  // (protectedProcedure alone doesn't distinguish anonymous vs real users
  // today — Phase 2+ concern if we need to gate that explicitly).
  plugins: [admin(), anonymous()],
} satisfies BetterAuthOptions;

export function createAuth(
  database: D1Database,
  secret: string,
  baseURL?: string
) {
  const db = getDb(database);

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
    }),
    secret,
    baseURL,
    ...drizzleConfig,
  });
}

export type Auth = ReturnType<typeof createAuth>;
