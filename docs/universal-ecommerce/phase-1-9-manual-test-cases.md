# Universal Ecommerce Phase 1–9 Manual Test Cases

এই checklist local/staging environment-এর জন্য। Production database-এ manual
fixture বা vertical preset ব্যবহার করবেন না। প্রতিটি case-এর পাশে `PASS`, `FAIL`
বা `BLOCKED` লিখুন এবং failure হলে screenshot, URL ও সময় নোট করুন।

## Test environment

- Base URL: `http://localhost:3000`
- Admin email: `phase9-admin@local.test`
- Customer email: `phase9-customer@local.test`
- Password: local seed চালানোর সময় `PHASE9_MANUAL_PASSWORD`-এ দেওয়া value
- In-stock products:
  - `Phase 9 Test Wireless Mouse` — BDT 1,250 — stock 25
  - `Phase 9 Test Mechanical Keyboard` — BDT 2,250 — stock 20
- Negative-stock product:
  - `Phase 9 Test Out-of-stock Headset` — stock 0

একটি Incognito window customer test-এর জন্য এবং একটি normal window admin test-এর
জন্য ব্যবহার করলে session conflict হবে না।

## Preflight

| ID | Steps | Expected result | Result |
|---|---|---|---|
| PRE-01 | `/` এবং `/ecommerce/products` খুলুন। | Page load হবে; Next.js error overlay/blank screen থাকবে না। | |
| PRE-02 | Browser console খুলুন এবং page reload করুন। | Blocking JavaScript error বা hydration error থাকবে না। | |
| PRE-03 | `Phase 9 Test` লিখে search করুন। | ৩টি manual fixture পাওয়া যাবে। | |
| PRE-04 | Admin ও customer account দিয়ে আলাদা browser session-এ sign in করুন। | Admin `/admin` access পাবে; customer storefront account page পাবে। | |

## Phase 1 — Universal commerce core

| ID | Steps | Expected result | Result |
|---|---|---|---|
| P1-01 | Homepage, category menu এবং footer দেখুন। | `General`, `Home & Living`, `Fashion`, `Books & Media`, `Services` usable থাকবে; broken image থাকবে না। | |
| P1-02 | Products page-এ `Phase 9 Test` search করুন, price/category filter ব্যবহার করুন, filter clear করুন। | URL ও result synchronized থাকবে; unknown/empty filter page ভাঙবে না। | |
| P1-03 | Mouse product খুলুন। তারপর out-of-stock headset খুলুন। | Mouse-এ price, image, stock এবং purchase action থাকবে; headset-এ out-of-stock state এবং disabled/blocked purchase থাকবে। | |
| P1-04 | Mouse cart-এ যোগ করুন, quantity 1→2 করুন, refresh করুন, তারপর 1 করুন। | Cart quantity/total সঠিক থাকবে এবং refresh-এর পর cart persist করবে। | |
| P1-05 | Keyboard product থেকে `Buy Now` চাপুন। | সরাসরি checkout-এ যাবে এবং Buy Now item-ই checkout summary-তে থাকবে। | |
| P1-06 | Customer account দিয়ে valid Bangladesh address/phone দিন, available shipping option এবং locally configured payment method নির্বাচন করে order করুন। | একবারই order তৈরি হবে; success/payment-result page-এ invoice/order reference দেখা যাবে। | |
| P1-07 | একই submit button দ্রুত দুবার চাপার চেষ্টা করুন অথবা success page refresh করুন। | Duplicate order তৈরি হবে না। | |
| P1-08 | Customer dashboard → Orders এবং order detail/invoice খুলুন। | নতুন order, item, quantity, price, shipping এবং total একই থাকবে। | |
| P1-09 | Admin → Orders-এ একই order খুলুন। | Customer order দেখা যাবে এবং status transition controls কাজ করবে। | |
| P1-10 | Cart থেকে একটি item remove করুন এবং empty cart checkout চেষ্টা করুন। | Item সঠিকভাবে remove হবে; empty cart থেকে order করা যাবে না। | |

## Phase 2 — Store Feature Registry

| ID | Steps | Expected result | Result |
|---|---|---|---|
| P2-01 | Admin → Settings → Features খুলুন। | PC Builder, Books, Authors, Compare, Digital Products, Service Products ও Bundles—৭টি feature দেখা যাবে। | |
| P2-02 | `COMPARE` off করে storefront reload করুন। | Compare navigation/action hidden বা inaccessible হবে; সাধারণ product/cart কাজ করবে। | |
| P2-03 | `COMPARE` আবার on করুন। | Compare action ফিরে আসবে। | |
| P2-04 | BOOKS off থাকা অবস্থায় AUTHORS on করার চেষ্টা করুন। | Dependency validation AUTHORS enable block করবে বা BOOKS prerequisite দেখাবে। | |

## Phase 3 — Feature gating across UI and APIs

| ID | Steps | Expected result | Result |
|---|---|---|---|
| P3-01 | PC Builder off রেখে `/ecommerce/pc-builder` খুলুন। | Module fail-closed হবে—hidden, redirect, not-found বা disabled response; unrestricted builder UI নয়। | |
| P3-02 | DIGITAL_PRODUCTS, SERVICE_PRODUCTS এবং BUNDLES একবার করে off করুন এবং সংশ্লিষ্ট create/discovery UI দেখুন। | Disabled product type create/discover/purchase করা যাবে না; physical products unaffected থাকবে। | |
| P3-03 | Feature values initial state-এ ফিরিয়ে দিন: Compare/Digital/Service/Bundles on; PC Builder/Books/Authors off। | Feature page ও storefront expected GENERAL state-এ ফিরবে। | |
| P3-04 | একটি completed/historical order খুলে feature off/on করুন। | Historical order read সব অবস্থায় available থাকবে। | |

## Phase 4 — Typed attributes

| ID | Steps | Expected result | Result |
|---|---|---|---|
| P4-01 | Admin product/category attribute UI-তে `Phase 9 Test Color` খুলুন। | Type `COLOR` এবং General category mapping দেখা যাবে। | |
| P4-02 | `Phase 9 Test Warranty` খুলুন। | Type `NUMBER`, unit `month`, filterable mapping দেখা যাবে। | |
| P4-03 | Mouse/Keyboard edit form খুলুন। | Color ও Warranty values typed field-এ load হবে; raw malformed value দেখাবে না। | |
| P4-04 | Warranty-তে text বা invalid number submit করার চেষ্টা করুন; পরে original value restore করুন। | Invalid typed value reject হবে; valid number save হবে। | |

## Phase 5 — Category/attribute policy integration

| ID | Steps | Expected result | Result |
|---|---|---|---|
| P5-01 | General category-এর attribute mappings দেখুন। | Manual Color ও Warranty mappings duplicate ছাড়া থাকবে। | |
| P5-02 | একটি temporary General product create form খুলুন। | শুধু category-approved attributes দেখাবে। | |
| P5-03 | অন্য category select করে attribute fields দেখুন। | Selected category অনুযায়ী policy/fields বদলাবে; General-only mapping leak করবে না। | |
| P5-04 | একটি optional mapping required করুন এবং required value ছাড়া temporary product save চেষ্টা করুন। | Validation save block করবে। Test শেষে mapping আবার optional করুন। | |
| P5-05 | Products page-এ manual Color/other mapped filter ব্যবহার করুন। | Filter typed attribute data অনুযায়ী products narrow করবে। | |

## Phase 6 — Category navigation and activation

| ID | Steps | Expected result | Result |
|---|---|---|---|
| P6-01 | Admin → Categories-এ General-এর Header/Footer visibility off করুন। | সংশ্লিষ্ট navigation placement থেকে General সরবে; direct valid page ভাঙবে না। | |
| P6-02 | General আবার Header/Footer visible করুন। | Navigation refresh/revalidation-এর পর category ফিরে আসবে। | |
| P6-03 | General category inactive করুন এবং storefront/search/cart-এ manual products দেখুন। | Category ও তার products discovery/purchase path থেকে gated হবে। | |
| P6-04 | General category active করে Header/Footer/Featured initial state restore করুন। | ৩টি manual product আবার search/product page-এ পাওয়া যাবে। | |
| P6-05 | Parent/child category তৈরি করে parent inactive করুন। | Child active হলেও parent inactive থাকলে child navigation/purchase visibility পাবে না। Test category পরে archive করুন। | |

## Phase 7 — Store identity, localization and SEO

পরীক্ষার আগে বর্তমান values লিখে রাখুন: Store name `Online Store`, store type
`GENERAL`, currency `BDT`, currency position `BEFORE`, timezone `Asia/Dhaka`, locale
`en-BD`।

| ID | Steps | Expected result | Result |
|---|---|---|---|
| P7-01 | Admin → Settings → General-এ store name `Online Store QA` করুন। | Header/title/metadata-তে নতুন identity দেখা যাবে; hard-coded TechHub/Bookstore branding থাকবে না। | |
| P7-02 | Currency position পরিবর্তন করে product page খুলুন। | Price presentation configured position অনুযায়ী বদলাবে। | |
| P7-03 | Invalid currency/locale/timezone submit করুন। | Validation invalid setting reject করবে। | |
| P7-04 | `/manifest.webmanifest`, `/robots.txt`, `/sitemap.xml` এবং page source metadata দেখুন। | Configured identity/URLs valid থাকবে; admin/private pages indexable হবে না। | |
| P7-05 | Store name এবং সব localization values initial state-এ restore করুন। | Store আবার `Online Store`/GENERAL/BDT/Asia-Dhaka/en-BD state-এ থাকবে। | |

## Phase 8 — Book module decoupling

| ID | Steps | Expected result | Result |
|---|---|---|---|
| P8-01 | BOOKS/AUTHORS off রেখে `/ecommerce/books` ও `/ecommerce/authors` খুলুন। | Dedicated module fail-closed হবে; generic catalog/product URLs usable থাকবে। | |
| P8-02 | BOOKS enable করুন; তারপর AUTHORS enable করুন। | Dependency order মেনে দুই module enable হবে এবং navigation/routes accessible হবে। | |
| P8-03 | Admin product edit-এ book metadata section পরীক্ষা করুন। Writer/Publisher set করে save/reload করুন। | BookMetadata values persist করবে; normal Product fields এবং legacy URL ভাঙবে না। | |
| P8-04 | AUTHORS off করুন, এরপর BOOKS off করুন। | Dependency-safe disable হবে; GENERAL initial feature state restore হবে। | |
| P8-05 | আগে তৈরি order/product detail আবার খুলুন। | Module toggle historical commerce data delete বা corrupt করবে না। | |

## Phase 9 — Distribution, seeds and credential safety

| ID | Steps | Expected result | Result |
|---|---|---|---|
| P9-01 | Admin settings/categories-এ current configured values নোট করুন; `npm run seed:universal` চালিয়ে reload করুন। | Existing non-empty settings/category configuration overwrite হবে না; duplicate category হবে না। | |
| P9-02 | `npm run verify:phase9-manual-test` চালান। | `products: 3, accounts: 2` সহ pass করবে। | |
| P9-03 | `npx tsx scripts/verify-universal-seed.ts` চালান। | `demoCredentialAccounts: 0`, ৫ category ও ৭ feature row দেখাবে। | |
| P9-04 | `admin@example.com` এবং পুরোনো published demo password দিয়ে sign in চেষ্টা করুন। | Login ব্যর্থ হবে; কোনো admin session তৈরি হবে না। | |
| P9-05 | Manual admin login করে sign out করুন; manual customer login করুন। | Role অনুযায়ী access আলাদা থাকবে; customer `/admin` access পাবে না। | |
| P9-06 | `npx prisma migrate status` চালান। | Database schema up to date এবং squashed baseline recorded দেখাবে। | |
| P9-07 | Dev server বন্ধ করে `npm run verify:universal-phase9` চালান। | Prisma generation, route types, Phase 1–9 tests, lint ও typecheck pass করবে। | |
| P9-08 | Tech/Fashion/Grocery/Book preset শুধুমাত্র disposable DB-তে apply ও verify করুন। | প্রতিটি preset exact store type, category, feature ও typed attribute mapping দেবে; products/orders delete করবে না। | |

## Responsive, accessibility and failure-path sweep

| ID | Steps | Expected result | Result |
|---|---|---|---|
| QA-01 | Chrome responsive mode-এ 360px, 768px ও desktop width-এ home/product/cart/checkout দেখুন। | Horizontal overflow, clipped action বা unusable navigation থাকবে না। | |
| QA-02 | শুধু keyboard দিয়ে header, product, cart ও checkout চালান। | Visible focus, logical tab order এবং Enter/Space action কাজ করবে। | |
| QA-03 | DevTools Accessibility tree/Lighthouse দিয়ে home/product/checkout দেখুন। | একটি H1, একটি main landmark, meaningful labels/alt text এবং acceptable contrast থাকবে। | |
| QA-04 | Network Offline করে cart/checkout action করুন, পরে Online করুন। | Friendly error দেখাবে; duplicate order বা silent data loss হবে না। | |
| QA-05 | Broken/invalid product URL এবং malformed query filter খুলুন। | Controlled not-found/empty state হবে; stack trace বা server crash নয়। | |

## Completion criteria

- সব critical cases `PASS`: PRE-01–04, P1-03–09, P2-01–04, P3-01–04,
  P5-04, P6-03–04, P7-01–05, P8-01–05, P9-01–07।
- কোনো duplicate order, negative inventory, authorization bypass, broken image,
  unhandled exception বা console hydration error থাকবে না।
- Configuration-changing test শেষে GENERAL initial state restore করতে হবে।

## Optional fixture cleanup after testing

Manual orders/history delete না করে fixture products archive এবং test account
credentials disable করতে:

```powershell
$env:ALLOW_PHASE9_MANUAL_FIXTURE_CLEANUP="true"
npm run cleanup:phase9-manual-test
```

পরবর্তীতে আবার manual test করতে password ও guard দিয়ে
`npm run seed:phase9-manual-test` চালালে reserved fixtures পুনরায় ready হবে।
