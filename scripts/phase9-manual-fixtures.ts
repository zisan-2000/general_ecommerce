export const PHASE9_MANUAL_TEST_ACCOUNTS = {
  admin: "phase9-admin@local.test",
  customer: "phase9-customer@local.test",
} as const;

export const PHASE9_MANUAL_TEST_PRODUCTS = [
  {
    name: "Phase 9 Test Wireless Mouse",
    slug: "phase9-test-wireless-mouse",
    sku: "PHASE9-MOUSE-001",
    price: "1250.00",
    stock: 25,
    image: "/upload/1772528587416-p61gpc9iype.webp",
    color: "Black",
    warrantyMonths: 12,
  },
  {
    name: "Phase 9 Test Mechanical Keyboard",
    slug: "phase9-test-mechanical-keyboard",
    sku: "PHASE9-KEYBOARD-001",
    price: "2250.00",
    stock: 20,
    image: "/upload/1772528571011-outc7n5wggh.webp",
    color: "Blue",
    warrantyMonths: 18,
  },
  {
    name: "Phase 9 Test Out-of-stock Headset",
    slug: "phase9-test-out-of-stock-headset",
    sku: "PHASE9-HEADSET-OOS-001",
    price: "1750.00",
    stock: 0,
    image: "/upload/1772528549027-7sm142rekgb.webp",
    color: "Black",
    warrantyMonths: 6,
  },
] as const;
