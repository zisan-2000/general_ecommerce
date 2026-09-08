import fs from "node:fs";
import path from "node:path";

const read = (file) => fs.readFileSync(file, "utf8");
const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.endsWith("\n") ? content : `${content}\n`);
};

function modelBlock(schema, name) {
  const match = schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`));
  if (!match) throw new Error(`Could not find Prisma model ${name}`);
  return match[0];
}

function replaceModel(schema, name, transform) {
  const block = modelBlock(schema, name);
  const next = transform(block);
  if (!next || next === block) throw new Error(`Prisma model ${name} was not changed`);
  return schema.replace(block, next);
}

let schema = read("prisma/schema.prisma");
if (schema.includes("model BookMetadata {")) {
  throw new Error("BookMetadata already exists; refusing to apply Phase 8 patch twice");
}

schema = replaceModel(schema, "Writer", (block) =>
  block.replace(/^  products\s+Product\[\]\s*$/m, "  bookMetadata BookMetadata[]"),
);
schema = replaceModel(schema, "Publisher", (block) =>
  block.replace(/^  products\s+Product\[\]\s*$/m, "  bookMetadata BookMetadata[]"),
);
schema = replaceModel(schema, "Product", (block) => {
  const lines = block.split("\n").filter((line) => {
    if (/^  (writerId|publisherId)\s/.test(line)) return false;
    if (/^  (writer|publisher)\s/.test(line)) return false;
    if (/^  @@index\(\[(writerId|publisherId),/.test(line)) return false;
    return true;
  });
  const digitalAssetIndex = lines.findIndex((line) => /^  digitalAsset\s/.test(line));
  if (digitalAssetIndex < 0) throw new Error("Product.digitalAsset anchor missing");
  lines.splice(digitalAssetIndex + 1, 0, "  bookMetadata            BookMetadata?");
  return lines.join("\n");
});

const bookModel = `model BookMetadata {
  id          Int        @id @default(autoincrement())
  productId   Int        @unique
  writerId    Int?
  publisherId Int?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  product     Product    @relation(fields: [productId], references: [id], onDelete: Cascade)
  writer      Writer?    @relation(fields: [writerId], references: [id], onDelete: SetNull)
  publisher   Publisher? @relation(fields: [publisherId], references: [id], onDelete: SetNull)

  @@index([writerId])
  @@index([publisherId])
}`;

const productBlock = modelBlock(schema, "Product");
schema = schema.replace(productBlock, `${productBlock}\n\n${bookModel}`);
write("prisma/schema.prisma", schema);

write(
  "prisma/migrations/20260908190000_decouple_book_metadata/migration.sql",
  `BEGIN;

CREATE TABLE "BookMetadata" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "writerId" INTEGER,
    "publisherId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookMetadata_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookMetadata_productId_key" ON "BookMetadata"("productId");
CREATE INDEX "BookMetadata_writerId_idx" ON "BookMetadata"("writerId");
CREATE INDEX "BookMetadata_publisherId_idx" ON "BookMetadata"("publisherId");

-- Preserve every legacy book relation before removing it from the generic Product core.
INSERT INTO "BookMetadata" (
    "productId",
    "writerId",
    "publisherId",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "writerId",
    "publisherId",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Product"
WHERE "writerId" IS NOT NULL OR "publisherId" IS NOT NULL;

ALTER TABLE "BookMetadata"
  ADD CONSTRAINT "BookMetadata_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookMetadata"
  ADD CONSTRAINT "BookMetadata_writerId_fkey"
  FOREIGN KEY ("writerId") REFERENCES "Writer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BookMetadata"
  ADD CONSTRAINT "BookMetadata_publisherId_fkey"
  FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_writerId_fkey";
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_publisherId_fkey";
DROP INDEX IF EXISTS "Product_writerId_deleted_available_idx";
DROP INDEX IF EXISTS "Product_publisherId_deleted_available_idx";

ALTER TABLE "Product"
  DROP COLUMN "writerId",
  DROP COLUMN "publisherId";

COMMIT;
`,
);

write(
  "lib/book-metadata.ts",
  `export type BookMetadataInput = {
  writerId: number | null;
  publisherId: number | null;
};

function parseNullableId(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") {
    return { ok: true as const, value: null };
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { ok: false as const, error: \`${label} must be a positive integer or null.\` };
  }

  return { ok: true as const, value: parsed };
}

export function parseBookMetadataInput(value: unknown):
  | { ok: true; value: BookMetadataInput }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Book metadata payload must be an object." };
  }

  const input = value as Record<string, unknown>;
  const writerId = parseNullableId(input.writerId, "writerId");
  if (!writerId.ok) return writerId;
  const publisherId = parseNullableId(input.publisherId, "publisherId");
  if (!publisherId.ok) return publisherId;

  return {
    ok: true,
    value: {
      writerId: writerId.value,
      publisherId: publisherId.value,
    },
  };
}

export function hasBookMetadata(input: BookMetadataInput) {
  return input.writerId !== null || input.publisherId !== null;
}
`,
);

write(
  "app/api/book-metadata/[productId]/route.ts",
  `import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAccessContext } from "@/lib/rbac";
import { gateStoreFeature } from "@/lib/store-feature-gates-server";
import { hasBookMetadata, parseBookMetadataInput } from "@/lib/book-metadata";

const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" } as const;

type Context = { params: Promise<{ productId: string }> };

function parseProductId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function requireProductManager() {
  const session = await getServerSession(authOptions);
  const access = await getAccessContext(
    session?.user as { id?: string; role?: string } | undefined,
  );
  if (!access.userId) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!access.has("products.manage")) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { access };
}

export async function GET(_request: Request, context: Context) {
  const gate = await gateStoreFeature("BOOKS", 404);
  if (gate) return gate;

  const { productId: rawId } = await context.params;
  const productId = parseProductId(rawId);
  if (!productId) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  const metadata = await prisma.bookMetadata.findUnique({
    where: { productId },
    include: {
      writer: { select: { id: true, name: true, image: true } },
      publisher: { select: { id: true, name: true, image: true } },
    },
  });
  if (!metadata) {
    return NextResponse.json({ error: "Book metadata not found" }, { status: 404 });
  }

  return NextResponse.json(metadata, { headers: PRIVATE_NO_STORE });
}

export async function PUT(request: Request, context: Context) {
  const gate = await gateStoreFeature("BOOKS", 403);
  if (gate) return gate;
  const auth = await requireProductManager();
  if ("response" in auth) return auth.response;

  const { productId: rawId } = await context.params;
  const productId = parseProductId(rawId);
  if (!productId) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  const parsed = parseBookMetadataInput(await request.json());
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, deleted: false },
    select: { id: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const { writerId, publisherId } = parsed.value;
  const [writer, publisher] = await Promise.all([
    writerId
      ? prisma.writer.findFirst({ where: { id: writerId, deleted: false }, select: { id: true } })
      : Promise.resolve(null),
    publisherId
      ? prisma.publisher.findFirst({ where: { id: publisherId, deleted: false }, select: { id: true } })
      : Promise.resolve(null),
  ]);
  if (writerId && !writer) {
    return NextResponse.json({ error: "Writer not found" }, { status: 400 });
  }
  if (publisherId && !publisher) {
    return NextResponse.json({ error: "Publisher not found" }, { status: 400 });
  }

  if (!hasBookMetadata(parsed.value)) {
    await prisma.bookMetadata.deleteMany({ where: { productId } });
    return NextResponse.json({ productId, writerId: null, publisherId: null }, { headers: PRIVATE_NO_STORE });
  }

  const metadata = await prisma.bookMetadata.upsert({
    where: { productId },
    create: { productId, writerId, publisherId },
    update: { writerId, publisherId },
    include: {
      writer: { select: { id: true, name: true, image: true } },
      publisher: { select: { id: true, name: true, image: true } },
    },
  });
  return NextResponse.json(metadata, { headers: PRIVATE_NO_STORE });
}

export async function DELETE(_request: Request, context: Context) {
  const gate = await gateStoreFeature("BOOKS", 403);
  if (gate) return gate;
  const auth = await requireProductManager();
  if ("response" in auth) return auth.response;

  const { productId: rawId } = await context.params;
  const productId = parseProductId(rawId);
  if (!productId) {
    return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
  }

  await prisma.bookMetadata.deleteMany({ where: { productId } });
  return NextResponse.json({ success: true }, { headers: PRIVATE_NO_STORE });
}
`,
);

write(
  "scripts/verify-book-metadata.ts",
  `import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const productColumns = await prisma.$queryRaw<Array<{ column_name: string }>>\`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Product'
  \`;
  const columns = new Set(productColumns.map((row) => row.column_name));
  for (const legacy of ["writerId", "publisherId"]) {
    if (columns.has(legacy)) {
      throw new Error(\`Phase 8 verification failed: Product.\${legacy} still exists.\`);
    }
  }

  const metadataTable = await prisma.$queryRaw<Array<{ count: bigint }>>\`
    SELECT COUNT(*)::bigint AS count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'BookMetadata'
  \`;
  if (Number(metadataTable[0]?.count ?? 0) !== 1) {
    throw new Error("Phase 8 verification failed: BookMetadata table is missing.");
  }

  const [orphans, invalidWriters, invalidPublishers, duplicateProducts] = await Promise.all([
    prisma.$queryRaw<Array<{ count: bigint }>>\`
      SELECT COUNT(*)::bigint AS count
      FROM "BookMetadata" bm
      LEFT JOIN "Product" p ON p."id" = bm."productId"
      WHERE p."id" IS NULL
    \`,
    prisma.$queryRaw<Array<{ count: bigint }>>\`
      SELECT COUNT(*)::bigint AS count
      FROM "BookMetadata" bm
      LEFT JOIN "Writer" w ON w."id" = bm."writerId"
      WHERE bm."writerId" IS NOT NULL AND w."id" IS NULL
    \`,
    prisma.$queryRaw<Array<{ count: bigint }>>\`
      SELECT COUNT(*)::bigint AS count
      FROM "BookMetadata" bm
      LEFT JOIN "Publisher" p ON p."id" = bm."publisherId"
      WHERE bm."publisherId" IS NOT NULL AND p."id" IS NULL
    \`,
    prisma.$queryRaw<Array<{ count: bigint }>>\`
      SELECT COUNT(*)::bigint AS count
      FROM (
        SELECT "productId"
        FROM "BookMetadata"
        GROUP BY "productId"
        HAVING COUNT(*) > 1
      ) duplicates
    \`,
  ]);

  const checks = {
    orphanProducts: Number(orphans[0]?.count ?? 0),
    invalidWriters: Number(invalidWriters[0]?.count ?? 0),
    invalidPublishers: Number(invalidPublishers[0]?.count ?? 0),
    duplicateProducts: Number(duplicateProducts[0]?.count ?? 0),
  };
  const failures = Object.entries(checks).filter(([, count]) => count !== 0);
  if (failures.length) {
    throw new Error(\`Phase 8 verification failed: \${JSON.stringify(checks)}\`);
  }

  const total = await prisma.bookMetadata.count();
  console.log("Phase 8 book metadata verification passed.", { rows: total, ...checks });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
`,
);

write(
  "tests/book-module-decoupling.test.mjs",
  `import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { hasBookMetadata, parseBookMetadataInput } from "../lib/book-metadata.ts";

const read = (file) => fs.readFileSync(file, "utf8");
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260908190000_decouple_book_metadata/migration.sql");

function model(name) {
  const match = schema.match(new RegExp(\`model \\${name} \\\\{[\\\\s\\\\S]*?\\\\n\\\\}\`));
  assert.ok(match, \`model \\${name} must exist\`);
  return match[0];
}

test("generic Product core has no direct writer or publisher columns", () => {
  const product = model("Product");
  assert.doesNotMatch(product, /\\bwriterId\\b/);
  assert.doesNotMatch(product, /\\bpublisherId\\b/);
  assert.doesNotMatch(product, /^\\s*writer\\s+Writer/m);
  assert.doesNotMatch(product, /^\\s*publisher\\s+Publisher/m);
  assert.match(product, /bookMetadata\\s+BookMetadata\\?/);
});

test("BookMetadata owns the one-to-one product and optional writer/publisher relations", () => {
  const metadata = model("BookMetadata");
  assert.match(metadata, /productId\\s+Int\\s+@unique/);
  assert.match(metadata, /product\\s+Product\\s+@relation\\(fields: \\[productId\\]/);
  assert.match(metadata, /writer\\s+Writer\\?\\s+@relation\\(fields: \\[writerId\\]/);
  assert.match(metadata, /publisher\\s+Publisher\\?\\s+@relation\\(fields: \\[publisherId\\]/);
  assert.match(model("Writer"), /bookMetadata\\s+BookMetadata\\[\\]/);
  assert.match(model("Publisher"), /bookMetadata\\s+BookMetadata\\[\\]/);
});

test("migration copies legacy relations before dropping Product columns", () => {
  const insertAt = migration.indexOf('INSERT INTO "BookMetadata"');
  const dropAt = migration.indexOf('DROP COLUMN "writerId"');
  assert.ok(insertAt >= 0 && dropAt > insertAt);
  assert.match(migration, /FROM "Product"/);
  assert.match(migration, /WHERE "writerId" IS NOT NULL OR "publisherId" IS NOT NULL/);
  assert.match(migration, /ON DELETE CASCADE/);
  assert.match(migration, /ON DELETE SET NULL/);
  assert.match(migration, /^BEGIN;/m);
  assert.match(migration, /^COMMIT;/m);
});

test("book metadata input is bounded to nullable positive relation ids", () => {
  assert.deepEqual(parseBookMetadataInput({ writerId: "12", publisherId: 4 }), {
    ok: true,
    value: { writerId: 12, publisherId: 4 },
  });
  assert.equal(parseBookMetadataInput({ writerId: -1 }).ok, false);
  assert.equal(parseBookMetadataInput({ publisherId: 1.2 }).ok, false);
  assert.equal(hasBookMetadata({ writerId: null, publisherId: null }), false);
  assert.equal(hasBookMetadata({ writerId: 1, publisherId: null }), true);
});

test("book metadata API is isolated behind BOOKS and product-management gates", () => {
  const route = read("app/api/book-metadata/[productId]/route.ts");
  assert.match(route, /gateStoreFeature\\("BOOKS"/);
  assert.match(route, /access\\.has\\("products\\.manage"\\)/);
  assert.match(route, /prisma\\.bookMetadata\\.upsert/);
  assert.match(route, /parseBookMetadataInput/);

  for (const file of ["app/api/products/route-core.ts", "app/api/products/[id]/route-core.ts"]) {
    const source = read(file);
    assert.doesNotMatch(source, /\\bwriterId\\b/);
    assert.doesNotMatch(source, /\\bpublisherId\\b/);
    assert.doesNotMatch(source, /bookMetadata/);
  }
});

test("legacy author/publisher endpoints remain dormant and module dependencies stay intact", () => {
  assert.match(read("app/api/writers/route.ts"), /status: 410/);
  assert.match(read("app/api/publishers/route.ts"), /status: 410/);
  const features = read("lib/store-features.ts");
  assert.match(features, /BOOKS:[\\s\\S]*?defaultEnabled: false/);
  assert.match(features, /AUTHORS:[\\s\\S]*?dependencies: \\["BOOKS"\\]/);
});

test("Phase 8 ships database verification, documentation and cumulative release wiring", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts["test:universal-phase8"], /book-module-decoupling/);
  assert.match(pkg.scripts["verify:book-metadata-db"], /verify-book-metadata/);
  assert.ok(pkg.scripts["verify:universal-phase8"]);
  assert.ok(fs.existsSync("docs/universal-ecommerce-phase8.md"));
  assert.ok(fs.existsSync(".github/workflows/universal-ecommerce-phase8.yml"));
  assert.equal(fs.existsSync(".github/workflows/universal-ecommerce-phase7.yml"), false);
});
`,
);

write(
  "docs/universal-ecommerce-phase8.md",
  `# Universal Ecommerce — Phase 8: Book Module Decoupling

## Goal

Remove book-specific Writer/Publisher ownership from the generic Product core while preserving every existing relation and keeping the optional BOOKS/AUTHORS modules independently controlled by the Store Feature Registry.

## Architecture

- \`Product\` owns only universal commerce concerns and now has a single optional \`bookMetadata\` extension relation.
- \`BookMetadata\` owns \`writerId\` and \`publisherId\`.
- \`Writer\` and \`Publisher\` relate to \`BookMetadata\`, never directly to generic \`Product\`.
- Generic product CRUD does not import or write book metadata.
- Book metadata has its own API boundary at \`/api/book-metadata/[productId]\` and is unavailable unless the \`BOOKS\` feature is enabled.
- Metadata writes require the existing \`products.manage\` permission.
- \`AUTHORS\` remains dependent on \`BOOKS\`; legacy writer/publisher endpoints remain dormant rather than silently reviving old bookstore behavior.

## Data migration safety

Migration \`20260908190000_decouple_book_metadata\` performs the transition in one PostgreSQL transaction:

1. Create \`BookMetadata\` and indexes.
2. Copy every Product row that has a legacy writer or publisher relation.
3. Add referential constraints.
4. Remove legacy Product foreign keys/indexes.
5. Drop \`Product.writerId\` and \`Product.publisherId\` only after the copy.

No product, writer, or publisher row is deleted. Product deletion cascades to its metadata; deleting a writer or publisher only nulls the relevant metadata relation.

## Deployment

Take a normal database backup/snapshot before schema deployment, then run:

\`\`\`bash
npx prisma migrate deploy
npm run verify:book-metadata-db
\`\`\`

The verifier is read-only. It fails if legacy Product columns remain, if \`BookMetadata\` is missing, or if orphaned/duplicate metadata relations exist.

## Verification

Local/source gate:

\`\`\`bash
npm run test:universal-phase8
npm run verify:universal-phase8
\`\`\`

CI additionally runs Prisma validation/generation, Next route type generation, the complete Phase 1–8 regression suite, lint, strict TypeScript and whitespace validation.

## Rollback

Before deployment, rollback is simply reverting the code/migration commit. After the migration has dropped legacy Product columns, restore from the pre-deployment database snapshot before reverting application code; do not recreate the legacy columns manually and guess relation data.

## Definition of Done

- Generic Product has no Writer/Publisher foreign keys or indexes.
- Existing book relation data is copied before legacy columns are removed.
- Book metadata is a one-to-one optional Product extension.
- BOOKS feature gate and product-management authorization protect the module boundary.
- Legacy bookstore APIs stay dormant.
- Database integrity verifier exists and is read-only.
- Phase 1–8 cumulative release gate passes before merge.
`,
);

const pkgPath = "package.json";
const pkg = JSON.parse(read(pkgPath));
pkg.scripts["test:universal-phase8"] = "tsx --test tests/book-module-decoupling.test.mjs";
pkg.scripts["verify:book-metadata-db"] = "tsx scripts/verify-book-metadata.ts";
pkg.scripts["verify:universal-phase8"] = "npx next typegen && npm run verify:universal-phase7 && npm run test:universal-phase8";
write(pkgPath, JSON.stringify(pkg, null, 2));

if (fs.existsSync(".github/workflows/universal-ecommerce-phase7.yml")) {
  fs.rmSync(".github/workflows/universal-ecommerce-phase7.yml");
}

write(
  ".github/workflows/universal-ecommerce-phase8.yml",
  `name: Universal Ecommerce Phase 8

on:
  pull_request:
    paths:
      - "app/**"
      - "components/ecommarce/**"
      - "components/Settings/**"
      - "lib/**"
      - "providers/**"
      - "scripts/**"
      - "tests/**"
      - "docs/universal-ecommerce-phase8.md"
      - "prisma/**"
      - "package.json"
      - "package-lock.json"
      - ".github/workflows/universal-ecommerce-phase8.yml"
  push:
    branches:
      - main
    paths:
      - "app/**"
      - "components/ecommarce/**"
      - "components/Settings/**"
      - "lib/**"
      - "providers/**"
      - "scripts/**"
      - "tests/**"
      - "docs/universal-ecommerce-phase8.md"
      - "prisma/**"
      - "package.json"
      - "package-lock.json"
      - ".github/workflows/universal-ecommerce-phase8.yml"

permissions:
  contents: read

concurrency:
  group: universal-ecommerce-phase8-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    name: Phase 1-8 release gate
    runs-on: ubuntu-latest
    timeout-minutes: 35
    env:
      NODE_OPTIONS: --max-old-space-size=6144
      DATABASE_URL: postgresql://schema_validation:schema_validation@127.0.0.1:5432/schema_validation

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm

      - name: Install dependencies
        run: npm ci --legacy-peer-deps --ignore-scripts

      - name: Validate Prisma schema
        run: npx prisma validate

      - name: Generate Prisma client
        run: npx prisma generate

      - name: Generate Next route types
        run: npx next typegen

      - name: Universal baseline
        run: npm run test:universal-baseline

      - name: Product and inventory regression suite
        run: npm run test:products && npm run test:order-idempotency

      - name: Universal Phase 2
        run: npm run test:universal-phase2

      - name: Universal Phase 3
        run: npm run test:universal-phase3

      - name: Universal Phase 4
        run: npm run test:universal-phase4

      - name: Universal Phase 5
        run: npm run test:universal-phase5

      - name: Universal Phase 6
        run: npm run test:universal-phase6

      - name: Universal Phase 7
        run: npm run test:universal-phase7

      - name: Phase 7 completion contract
        run: npx tsx --test tests/phase7-completion.test.mjs

      - name: Universal Phase 8
        run: npm run test:universal-phase8

      - name: Lint
        run: npm run lint

      - name: TypeScript
        run: npx tsc --noEmit

      - name: Check whitespace
        run: git diff --check HEAD^
`,
);

console.log("Phase 8 source patch applied.");
