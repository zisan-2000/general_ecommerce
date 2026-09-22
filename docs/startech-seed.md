# Star Tech catalog workflow

Run these commands from the project root. The builder refreshes the existing
`prisma/startech_productseed.json` structure, retains existing slugs/SKUs for
available products, and attempts up to 50 unique products per target category.
It fetches live listing and product pages, excludes unavailable/pre-order items,
and derives the stats from the generated records. It does not download images
or connect to a database. HTML responses are cached in the system temporary
directory for one hour to allow interrupted runs to resume.

```powershell
python -m pip install requests beautifulsoup4
python startech_catalog_builder.py
python startech_catalog_builder.py --validate-only
```

Test image downloads (first 10 products; existing images are skipped):

```powershell
python download_startech_images.py --json prisma/startech_productseed.json --project-root . --limit 10
```

Download all missing images:

```powershell
python download_startech_images.py --json prisma/startech_productseed.json --project-root .
```

Replace existing images, including older thumbnails:

```powershell
python download_startech_images.py --json prisma/startech_productseed.json --project-root . --overwrite
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

The unqualified `npm run seed:universal` runs all existing demo modules, resets
the demo admin credentials, and archives catalog records outside its curated
storefront before importing both product seed files. Use `--products-only` for
this Star Tech workflow to avoid those unrelated operations.

Checks without seeding or contacting the database:

```powershell
python -m unittest discover -s tests -p test_startech_catalog.py
node --import tsx --test tests/startech-seed.test.mjs
python startech_catalog_builder.py --validate-only
```
