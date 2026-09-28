import { loadEnvConfig } from "@next/env";
import type { PrismaConfig } from "prisma";

loadEnvConfig(process.cwd());

export default {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations-release",
    seed: "tsx prisma/seed.ts",
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
