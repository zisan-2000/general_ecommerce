export const WAREHOUSE_SEED_PASSWORD = "warehouse123";

export const WAREHOUSE_USERS = [
  { key: "manager", email: "warehouse.manager@boe.demo", name: "Warehouse Manager", phone: "01821000001", role: "warehouse_manager" },
  { key: "logistics", email: "logistics.lead@boe.demo", name: "Logistics Lead", phone: "01821000002", role: "logistics" },
  { key: "stock", email: "stock.officer@boe.demo", name: "Stock Officer", phone: "01821000003", role: "warehouse_staff" },
  { key: "payroll", email: "payroll.officer@boe.demo", name: "Payroll Officer", phone: "01821000004", role: "payroll" },
  { key: "customer", email: "warehouse.customer@boe.demo", name: "Warehouse Demo Customer", phone: "01821000005", role: "user" },
  { key: "delivery1", email: "warehouse.delivery1@boe.demo", name: "Delivery Man One", phone: "01822000001", role: "delivery" },
  { key: "delivery2", email: "warehouse.delivery2@boe.demo", name: "Delivery Man Two", phone: "01822000002", role: "delivery" },
  { key: "delivery3", email: "warehouse.delivery3@boe.demo", name: "Delivery Man Three", phone: "01822000003", role: "delivery" },
  { key: "delivery4", email: "warehouse.delivery4@boe.demo", name: "Delivery Man Four", phone: "01822000004", role: "delivery" },
  { key: "delivery5", email: "warehouse.delivery5@boe.demo", name: "Delivery Man Five", phone: "01822000005", role: "delivery" },
] as const;

export const WAREHOUSE_LIST = [
  { key: "dhaka", code: "WH-DHK-001", name: "Dhaka Central Warehouse", division: "Dhaka", district: "Dhaka", area: "Tejgaon", postCode: "1208", latitude: 23.7644, longitude: 90.3890, radius: 18 },
  { key: "ctg", code: "WH-CTG-001", name: "Chattogram Port Warehouse", division: "Chattogram", district: "Chattogram", area: "Agrabad", postCode: "4100", latitude: 22.3331, longitude: 91.8123, radius: 20 },
  { key: "sylhet", code: "WH-SYL-001", name: "Sylhet Regional Warehouse", division: "Sylhet", district: "Sylhet", area: "Zindabazar", postCode: "3100", latitude: 24.8949, longitude: 91.8687, radius: 15 },
  { key: "khulna", code: "WH-KHL-001", name: "Khulna Regional Warehouse", division: "Khulna", district: "Khulna", area: "Khalishpur", postCode: "9000", latitude: 22.8456, longitude: 89.5403, radius: 14 },
  { key: "rajshahi", code: "WH-RAJ-001", name: "Rajshahi Regional Warehouse", division: "Rajshahi", district: "Rajshahi", area: "Shaheb Bazar", postCode: "6000", latitude: 24.3745, longitude: 88.6042, radius: 12 },
] as const;

export const WAREHOUSE_CATEGORIES = [
  { key: "shoes", name: "Warehouse Shoes", slug: "warehouse-shoes" },
  { key: "bags", name: "Warehouse Bags", slug: "warehouse-bags" },
  { key: "apparel", name: "Warehouse Apparel", slug: "warehouse-apparel" },
  { key: "accessories", name: "Warehouse Accessories", slug: "warehouse-accessories" },
  { key: "home", name: "Warehouse Home", slug: "warehouse-home" },
] as const;

export const WAREHOUSE_BRANDS = [
  { key: "eden", name: "Eden Warehouse", slug: "eden-warehouse" },
  { key: "aero", name: "Aero Warehouse", slug: "aero-warehouse" },
  { key: "prime", name: "Prime Stock", slug: "prime-stock" },
  { key: "daily", name: "Daily Supply", slug: "daily-supply" },
  { key: "nova", name: "Nova Essentials", slug: "nova-essentials" },
] as const;

export const WAREHOUSE_PRODUCTS = [
  { key: "shoe", name: "Warehouse Running Shoe", slug: "warehouse-running-shoe", sku: "WH-PROD-SHOE-001", variantSku: "WH-VAR-SHOE-001", categoryKey: "shoes", brandKey: "aero", price: 3200, stock: 120, low: 20, cost: 1900, options: { color: "Black", size: "42" } },
  { key: "bag", name: "Warehouse Leather Bag", slug: "warehouse-leather-bag", sku: "WH-PROD-BAG-001", variantSku: "WH-VAR-BAG-001", categoryKey: "bags", brandKey: "eden", price: 2500, stock: 85, low: 15, cost: 1450, options: { color: "Brown", size: "Regular" } },
  { key: "shirt", name: "Warehouse Cotton Shirt", slug: "warehouse-cotton-shirt", sku: "WH-PROD-SHIRT-001", variantSku: "WH-VAR-SHIRT-001", categoryKey: "apparel", brandKey: "prime", price: 1450, stock: 160, low: 30, cost: 780, options: { color: "Blue", size: "L" } },
  { key: "watch", name: "Warehouse Smart Watch", slug: "warehouse-smart-watch", sku: "WH-PROD-WATCH-001", variantSku: "WH-VAR-WATCH-001", categoryKey: "accessories", brandKey: "nova", price: 4200, stock: 60, low: 10, cost: 2600, options: { color: "Black", size: "One Size" } },
  { key: "lamp", name: "Warehouse Desk Lamp", slug: "warehouse-desk-lamp", sku: "WH-PROD-LAMP-001", variantSku: "WH-VAR-LAMP-001", categoryKey: "home", brandKey: "daily", price: 1750, stock: 95, low: 18, cost: 980, options: { color: "White", size: "Medium" } },
] as const;

export const WAREHOUSE_COURIERS = [
  { key: "steadfast", name: "WH Steadfast", type: "STEADFAST", baseUrl: "https://steadfast.example.com" },
  { key: "redx", name: "WH RedX", type: "REDX", baseUrl: "https://redx.example.com" },
  { key: "pathao", name: "WH Pathao", type: "PATHAO", baseUrl: "https://pathao.example.com" },
  { key: "custom", name: "WH Local Fleet", type: "CUSTOM", baseUrl: "https://fleet.example.com" },
  { key: "express", name: "WH Express Runner", type: "CUSTOM", baseUrl: "https://express.example.com" },
] as const;
