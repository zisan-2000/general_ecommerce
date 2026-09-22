# Tech product catalog workflow

The current catalog source is `prisma/TechProductSeed.json` (942 products and
17 categories). Both `prisma/seed-universal.ts` and the legacy `prisma/seed.ts`
import it after the demo storefront, so its records remain visible. Existing
product slugs/SKUs are retained. Products are upserted by slug and variants by
product/SKU. Shared vendor URLs do not collapse distinct product identities.

Run commands from the project root. Image downloader dependencies:

```powershell
python -m pip install requests beautifulsoup4
```

Test image downloads (first 10 products; existing images are skipped):

```powershell
python download_startech_images.py --json prisma/TechProductSeed.json --project-root . --limit 10
```

Download all missing images:

```powershell
python download_startech_images.py --json prisma/TechProductSeed.json --project-root .
```

Replace existing images, including older thumbnails:

```powershell
python download_startech_images.py --json prisma/TechProductSeed.json --project-root . --overwrite
```

Images are saved to `public/images/products/startech/<category>/<filename>` and
served by Next.js at `/images/products/startech/<category>/<filename>`. Include
the downloaded files in your deployment. The downloader handles the primary
image of each product; the generated gallery contains that same local image.
It leaves the seed JSON untouched unless `--update-json` is supplied.

Import only this catalog into the database configured for the project:

```powershell
npm run seed:universal -- --products-only
```

A warehouse must already exist for initial stock allocation. Stock `10` is the
existing project's seed quantity, not a quantity reported by Star Tech. The
importer upserts categories, brands, products, and variants, persists model and
warranty, and retains warehouse stock quantities/reservations on re-import.
The source URLs and local file fields are downloader metadata; Prisma stores
the public `image` and `gallery` paths.

`npx prisma db seed` is configured to run the universal seed. Like the unqualified
`npm run seed:universal`, it runs all existing demo modules, resets
the demo admin credentials, and archives catalog records outside its curated
storefront before importing both product seed files. Use `--products-only` for
this Star Tech workflow to avoid those unrelated operations.

Checks without seeding or contacting the database:

```powershell
python -m unittest discover -s tests -p test_startech_catalog.py
node --import tsx --test tests/startech-seed.test.mjs
```
