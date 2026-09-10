CREATE TABLE "ProductSpecificationGroup" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSpecificationGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductSpecificationItem" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSpecificationItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductSpecificationGroup_productId_position_idx"
ON "ProductSpecificationGroup"("productId", "position");

CREATE INDEX "ProductSpecificationItem_groupId_position_idx"
ON "ProductSpecificationItem"("groupId", "position");

ALTER TABLE "ProductSpecificationGroup"
ADD CONSTRAINT "ProductSpecificationGroup_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductSpecificationItem"
ADD CONSTRAINT "ProductSpecificationItem_groupId_fkey"
FOREIGN KEY ("groupId") REFERENCES "ProductSpecificationGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
