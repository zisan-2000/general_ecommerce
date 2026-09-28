export const OPERATIONS_PASSWORD = "operations123";

export const OPERATION_USERS = [
  { key: "customerA", email: "ops.customer.a@boe.demo", name: "Ayesha Rahman", phone: "01711000001", role: "user" },
  { key: "customerB", email: "ops.customer.b@boe.demo", name: "Tanvir Hasan", phone: "01711000002", role: "user" },
  { key: "customerC", email: "ops.customer.c@boe.demo", name: "Nusrat Jahan", phone: "01711000003", role: "user" },
  { key: "orderManager", email: "ops.order.manager@boe.demo", name: "Order Manager", phone: "01711000004", role: "operations" },
  { key: "deliveryAgent", email: "ops.delivery.agent@boe.demo", name: "Delivery Agent Dhaka", phone: "01711000005", role: "delivery_man" },
  { key: "deliveryChattogram", email: "ops.delivery.ctg@boe.demo", name: "Delivery Agent Chattogram", phone: "01711000006", role: "delivery_man" },
  { key: "deliverySylhet", email: "ops.delivery.syl@boe.demo", name: "Delivery Agent Sylhet", phone: "01711000007", role: "delivery_man" },
  { key: "deliveryKhulna", email: "ops.delivery.khl@boe.demo", name: "Delivery Agent Khulna", phone: "01711000008", role: "delivery_man" },
] as const;

export const OPERATION_CATEGORIES = [
  { key: "shoes", name: "Operations Shoes", slug: "ops-shoes" },
  { key: "bags", name: "Operations Bags", slug: "ops-bags" },
  { key: "apparel", name: "Operations Apparel", slug: "ops-apparel" },
  { key: "accessories", name: "Operations Accessories", slug: "ops-accessories" },
  { key: "home", name: "Operations Home", slug: "ops-home" },
] as const;

export const OPERATION_BRANDS = [
  { key: "eden", name: "OPS Eden Basics", slug: "ops-eden-basics" },
  { key: "aero", name: "OPS AeroStep", slug: "ops-aerostep" },
  { key: "urban", name: "OPS UrbanCraft", slug: "ops-urbancraft" },
  { key: "nova", name: "OPS NovaWear", slug: "ops-novawear" },
  { key: "home", name: "OPS HomeNest", slug: "ops-homenest" },
] as const;

export const OPERATION_PRODUCTS = [
  {
    key: "runningShoe",
    name: "AeroStep Running Shoe",
    slug: "ops-aerostep-running-shoe",
    sku: "OPS-SHOE-001",
    categoryKey: "shoes",
    brandKey: "aero",
    basePrice: 3200,
    originalPrice: 3800,
    variantSku: "OPS-SHOE-001-BLK-42",
    stock: 80,
    options: { color: "Black", size: "42" },
    image: "/demo/operations/running-shoe.jpg",
  },
  {
    key: "leatherBag",
    name: "Eden Daily Leather Bag",
    slug: "ops-eden-daily-leather-bag",
    sku: "OPS-BAG-001",
    categoryKey: "bags",
    brandKey: "eden",
    basePrice: 2500,
    originalPrice: 3000,
    variantSku: "OPS-BAG-001-BRN",
    stock: 45,
    options: { color: "Brown", size: "Regular" },
    image: "/demo/operations/leather-bag.jpg",
  },
  {
    key: "denimJacket",
    name: "UrbanCraft Denim Jacket",
    slug: "ops-urbancraft-denim-jacket",
    sku: "OPS-APP-001",
    categoryKey: "apparel",
    brandKey: "urban",
    basePrice: 4200,
    originalPrice: 4900,
    variantSku: "OPS-APP-001-BLU-L",
    stock: 30,
    options: { color: "Blue", size: "L" },
    image: "/demo/operations/denim-jacket.jpg",
  },
  {
    key: "smartWatch",
    name: "NovaWear Smart Watch",
    slug: "ops-novawear-smart-watch",
    sku: "OPS-ACC-001",
    categoryKey: "accessories",
    brandKey: "nova",
    basePrice: 5200,
    originalPrice: 5900,
    variantSku: "OPS-ACC-001-BLK",
    stock: 25,
    options: { color: "Black", size: "One Size" },
    image: "/demo/operations/smart-watch.jpg",
  },
  {
    key: "deskLamp",
    name: "HomeNest Desk Lamp",
    slug: "ops-homenest-desk-lamp",
    sku: "OPS-HOME-001",
    categoryKey: "home",
    brandKey: "home",
    basePrice: 1800,
    originalPrice: 2200,
    variantSku: "OPS-HOME-001-WHT",
    stock: 60,
    options: { color: "White", size: "Standard" },
    image: "/demo/operations/desk-lamp.jpg",
  },
] as const;

export const OPERATION_WAREHOUSES = [
  { key: "dhaka", name: "Dhaka Main Warehouse", code: "OPS-WH-DHK", division: "Dhaka", district: "Dhaka", area: "Tejgaon" },
  { key: "chattogram", name: "Chattogram Hub", code: "OPS-WH-CTG", division: "Chattogram", district: "Chattogram", area: "Agrabad" },
  { key: "sylhet", name: "Sylhet Mini Hub", code: "OPS-WH-SYL", division: "Sylhet", district: "Sylhet", area: "Zindabazar" },
  { key: "rajshahi", name: "Rajshahi Fulfillment Point", code: "OPS-WH-RAJ", division: "Rajshahi", district: "Rajshahi", area: "Shaheb Bazar" },
  { key: "khulna", name: "Khulna Delivery Hub", code: "OPS-WH-KHL", division: "Khulna", district: "Khulna", area: "Sonadanga" },
] as const;

export const OPERATION_COURIERS = [
  { key: "steadfast", name: "OPS Steadfast Demo", type: "STEADFAST", baseUrl: "https://steadfast.example.com" },
  { key: "pathao", name: "OPS Pathao Demo", type: "PATHAO", baseUrl: "https://pathao.example.com" },
  { key: "redx", name: "OPS RedX Demo", type: "REDX", baseUrl: "https://redx.example.com" },
  { key: "custom", name: "OPS Local Delivery", type: "CUSTOM", baseUrl: "https://delivery.boe.local" },
  { key: "express", name: "OPS Express Rider", type: "CUSTOM", baseUrl: "https://express.boe.local" },
] as const;
