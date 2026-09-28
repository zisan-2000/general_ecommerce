Deshi Plus FULL PRODUCT SEED - HOW TO USE
========================================

Files in this package
---------------------
1. build_startech_full_seed.py
   Reads category/subcategory/brand hierarchy + product image hierarchy,
   matches every image filename to Deshi Plus, scrapes details/specifications,
   and writes a Prisma-oriented JSON seed.

2. seed-startech-generated.ts
   Put this file in your project's prisma/ folder. It imports the generated
   JSON into your current Prisma schema and creates categories, brands,
   products, variants, variant options/values, specification groups/items,
   stock levels, barcode and QR code records.

Python dependencies
-------------------
python -m pip install requests beautifulsoup4

Recommended project files
-------------------------
category_subcategory_brand_seed.json
product_image_hierarchy.json
build_startech_full_seed.py

Generate a small test first
---------------------------
python build_startech_full_seed.py --limit 10

Test Hisense fridge only
------------------------
python build_startech_full_seed.py --category appliance --subcategory fridge --brand hisense --limit 5

Test TV wall mount only
-----------------------
python build_startech_full_seed.py --category television-shop --subcategory tv-stand-wall-mount --limit 5

Generate everything
-------------------
python build_startech_full_seed.py

Default generated files
-----------------------
prisma/startech_full_product_seed.json
prisma/startech_full_product_seed.stats.json
prisma/startech_full_product_seed.unmatched.json

Default stock / seed behavior
-----------------------------
- stock = 200
- costPrice = source price * 0.96
- currency = BDT
- product type = PHYSICAL
- inventory item class = CONSUMABLE
- local products are available by default even if current Deshi Plus status is
  Out Of Stock; Deshi Plus status is retained in sourceStatus.
- To mirror current Deshi Plus availability exactly, add:
    --respect-source-availability

Run Prisma seed
---------------
Copy seed-startech-generated.ts to:
    prisma/seed-startech-generated.ts

Then run:
    npx tsx prisma/seed-startech-generated.ts prisma/startech_full_product_seed.json

What specifications become
--------------------------
For every Deshi Plus specification row, the generator creates:
- specificationGroups[] / items[]
- variantOptions[] / values[]
- one default ProductVariant.options JSON entry

This matches the current application pattern where the storefront can read
ProductVariantOption rows, while specificationGroups preserve grouped detail
sections.

Image behavior
--------------
The local image path is used as Product.image, for example:
/images/products/appliance/fridge/Hisense/hisense-bd189blk-deep-freezer.png

Because there is one local primary image per product, Product.gallery is [] to
avoid showing the same image twice.

Matching safety
---------------
1. Try exact Deshi Plus URL from image filename first.
2. If it does not resolve to a product, use Deshi Plus product search.
3. Fuzzy search results below the confidence threshold are rejected.
4. Rejected/failed products are written to *.unmatched.json instead of being
   assigned to the wrong product.
5. HTML is cached under .cache/startech-full-seed so interrupted runs can resume
   without re-downloading already cached pages.

Existing database compatibility
-------------------------------
The TypeScript importer reuses important current application category slugs,
including examples such as:
- component -> components
- ram-desktop -> desktop-ram
- casing -> pc-case
- desktop -> desktop-pc
- appliance -> home-appliance
- television-shop -> television

If a generated child slug already exists under a different parent, the importer
does NOT re-parent the old category. It creates/reuses a parent-prefixed slug
for the Deshi Plus branch instead.

Products are matched against the database by slug AND SKU. If the Deshi Plus
slug changed but the SKU/MPN already exists, the existing Product row is
updated and its public slug is preserved. This prevents duplicates such as an
existing Kingston product with SKU KF432C16BWA/8.
