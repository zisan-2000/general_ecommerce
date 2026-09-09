import nextEnv from "@next/env";
import type { PrismaConfig } from "prisma";

nextEnv.loadEnvConfig(process.cwd());

export default {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed-universal.ts",
  },
  experimental: {
    externalTables: true,
  },
  tables: {
    external: [
      "public.PcBuildCartItem",
      "public.PcBuildOrderItem",
      "public.PcBuilderSavedBuild",
    ],
  },
} satisfies PrismaConfig;
