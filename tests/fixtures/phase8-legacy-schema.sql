CREATE TABLE "Writer" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE
);

CREATE TABLE "Publisher" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE
);

CREATE TABLE "Product" (
  "id" SERIAL PRIMARY KEY,
  "writerId" INTEGER,
  "publisherId" INTEGER,
  "deleted" BOOLEAN NOT NULL DEFAULT FALSE,
  "available" BOOLEAN NOT NULL DEFAULT TRUE,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Product_writerId_fkey" FOREIGN KEY ("writerId") REFERENCES "Writer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Product_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Product_writerId_deleted_available_idx" ON "Product"("writerId", "deleted", "available");
CREATE INDEX "Product_publisherId_deleted_available_idx" ON "Product"("publisherId", "deleted", "available");

INSERT INTO "Writer" ("name") VALUES ('Phase 8 Writer');
INSERT INTO "Publisher" ("name") VALUES ('Phase 8 Publisher');
INSERT INTO "Product" ("writerId", "publisherId") VALUES (1, 1), (1, NULL), (NULL, 1), (NULL, NULL);
