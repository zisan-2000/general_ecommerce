# StarTec database seed

From the project root, with DATABASE_URL configured in `.env` and database migrations already applied:

```sh
npx prisma generate
npx prisma db seed
```

This creates or updates these accounts, then imports the product catalog:

| Account | Password | Access |
| --- | --- | --- |
| admin@example.com | admin123 | Administrator with global superadmin RBAC access |
| user@example.com | user123 | Customer |

Set `SEED_ADMIN_PASSWORD` or `SEED_USER_PASSWORD` to override these passwords. Each run resets these two accounts' passwords to the configured values.

## Adding products

Place product JSON anywhere under `prisma/StarTec Product Seed/`. It must have `categories` and `products` arrays in the same format as the existing files. Categories must include the product's category and its ancestors, with parents before children.

The importer discovers folders recursively on every run. It imports `_all.json` first within each folder, skips split files whose products are already covered by that aggregate, and imports additional product JSON files automatically. Progress files, statistics, and index manifests are ignored during folder discovery. No manual index update is needed.

Use a new folder such as `prisma/StarTec Product Seed/custom/` for additional files. Use unique product slugs and SKUs for new products. Matching slugs or SKUs update existing products. To change products already in an `_all.json`, edit that aggregate; its split copies are skipped.

Existing product seed JSON has `available: true`. Future JSON should also use `available: true` for products that should appear on the storefront. Stock quantities, prices, and variant `active` flags are imported as supplied; product visibility does not itself make a variant purchasable.

To import products only:

```sh
npm run seed:startech
```

To import a particular JSON or folder:

```sh
npx tsx prisma/startech-seed/index.ts "prisma/StarTec Product Seed/custom"
```

Reruns update existing products without deleting the catalog. If interrupted, rerun the same command. Importing the full catalog also imports variants, specifications, warehouse stock, and product codes, so it can take time. The final log reports completed groups and unique imported products. Storefront cached counts may take time to refresh.
