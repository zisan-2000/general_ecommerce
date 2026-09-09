export const SEED_PROFILES = [
  "universal",
  "technology-demo",
  "full-demo",
] as const;

export type SeedProfile = (typeof SEED_PROFILES)[number];

const DEMO_PROFILES = new Set<SeedProfile>([
  "technology-demo",
  "full-demo",
]);

export function parseSeedProfile(value: unknown): SeedProfile {
  const normalized = String(value ?? "universal")
    .trim()
    .toLowerCase();

  if (SEED_PROFILES.includes(normalized as SeedProfile)) {
    return normalized as SeedProfile;
  }

  throw new Error(
    `Unsupported SEED_PROFILE "${normalized}". Expected one of: ${SEED_PROFILES.join(", ")}.`,
  );
}

export function isDemoSeedProfile(profile: SeedProfile) {
  return DEMO_PROFILES.has(profile);
}

export function assertDemoSeedAllowed(
  profile: SeedProfile,
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  if (!isDemoSeedProfile(profile)) return;

  if (env.ALLOW_DEMO_CREDENTIALS !== "true") {
    throw new Error(
      `${profile} can create known demo credentials. Set ALLOW_DEMO_CREDENTIALS=true only in an isolated demo environment.`,
    );
  }

  if (env.ALLOW_DESTRUCTIVE_DEMO_SEED !== "true") {
    throw new Error(
      `${profile} can replace or archive demo storefront state. Set ALLOW_DESTRUCTIVE_DEMO_SEED=true only when that behavior is explicitly intended.`,
    );
  }
}
