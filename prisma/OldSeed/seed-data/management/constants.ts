export const MANAGEMENT_CATEGORIES = [
  {
    key: "footwear",
    name: "Footwear",
    slug: "mgmt-footwear",
    image: "/demo/categories/footwear.jpg",
  },
  {
    key: "apparel",
    name: "Apparel",
    slug: "mgmt-apparel",
    image: "/demo/categories/apparel.jpg",
  },
  {
    key: "bags",
    name: "Bags",
    slug: "mgmt-bags",
    image: "/demo/categories/bags.jpg",
  },
  {
    key: "accessories",
    name: "Accessories",
    slug: "mgmt-accessories",
    image: "/demo/categories/accessories.jpg",
  },
  {
    key: "homeLifestyle",
    name: "Home & Lifestyle",
    slug: "mgmt-home-lifestyle",
    image: "/demo/categories/home.jpg",
  },
] as const;

export const MANAGEMENT_BRANDS = [
  {
    key: "edenBasics",
    name: "Eden Basics",
    slug: "mgmt-eden-basics",
    logo: "/demo/brands/eden-basics.svg",
  },
  {
    key: "aeroStep",
    name: "AeroStep",
    slug: "mgmt-aerostep",
    logo: "/demo/brands/aerostep.svg",
  },
  {
    key: "northPeak",
    name: "NorthPeak",
    slug: "mgmt-northpeak",
    logo: "/demo/brands/northpeak.svg",
  },
  {
    key: "urbanNest",
    name: "UrbanNest",
    slug: "mgmt-urban-nest",
    logo: "/demo/brands/urban-nest.svg",
  },
  {
    key: "softTrail",
    name: "SoftTrail",
    slug: "mgmt-soft-trail",
    logo: "/demo/brands/soft-trail.svg",
  },
] as const;

export const MANAGEMENT_COURIERS = [
  {
    key: "steadfast",
    name: "Management Steadfast Demo",
    type: "STEADFAST",
    baseUrl: "https://steadfast.example.com",
  },
  {
    key: "pathao",
    name: "Management Pathao Demo",
    type: "PATHAO",
    baseUrl: "https://pathao.example.com",
  },
  {
    key: "redx",
    name: "Management RedX Demo",
    type: "REDX",
    baseUrl: "https://redx.example.com",
  },
  {
    key: "paperfly",
    name: "Management Paperfly Demo",
    type: "CUSTOM",
    baseUrl: "https://paperfly.example.com",
  },
  {
    key: "local",
    name: "Management Local Fleet",
    type: "CUSTOM",
    baseUrl: "https://delivery.local.example.com",
  },
] as const;

export const MANAGEMENT_VAT_CLASSES = [
  {
    key: "standard",
    code: "MGMT-VAT-STANDARD",
    name: "Standard VAT",
    description: "Default taxable product VAT class.",
    rate: 0.15,
    inclusive: false,
  },
  {
    key: "reduced",
    code: "MGMT-VAT-REDUCED",
    name: "Reduced VAT",
    description: "Reduced VAT for selected essentials.",
    rate: 0.075,
    inclusive: false,
  },
  {
    key: "zero",
    code: "MGMT-VAT-ZERO",
    name: "Zero Rated",
    description: "Zero rated export or exempt scenario.",
    rate: 0.0,
    inclusive: false,
  },
  {
    key: "inclusive",
    code: "MGMT-VAT-INCLUSIVE",
    name: "Inclusive VAT",
    description: "Price already includes VAT.",
    rate: 0.05,
    inclusive: true,
  },
  {
    key: "service",
    code: "MGMT-VAT-SERVICE",
    name: "Service VAT",
    description: "Service and logistics VAT class.",
    rate: 0.1,
    inclusive: false,
  },
] as const;

export const MANAGEMENT_BLOGS = [
  {
    key: "launch",
    slug: "mgmt-spring-launch-guide",
    title: "Spring Launch Guide",
    summary: "How the team prepares new seasonal collections.",
    author: "BOE Editorial",
    image: "/demo/blogs/spring-launch.jpg",
  },
  {
    key: "warehouse",
    slug: "mgmt-warehouse-operations",
    title: "Warehouse Operations Checklist",
    summary: "Daily warehouse practices for faster dispatch.",
    author: "Operations Team",
    image: "/demo/blogs/warehouse.jpg",
  },
  {
    key: "delivery",
    slug: "mgmt-delivery-experience",
    title: "Improving Delivery Experience",
    summary: "A practical guide to delivery communication.",
    author: "Delivery Team",
    image: "/demo/blogs/delivery.jpg",
  },
  {
    key: "customer",
    slug: "mgmt-customer-retention",
    title: "Customer Retention Basics",
    summary: "Simple retention ideas for ecommerce teams.",
    author: "Growth Team",
    image: "/demo/blogs/customer.jpg",
  },
  {
    key: "vat",
    slug: "mgmt-vat-and-pricing",
    title: "VAT and Pricing Notes",
    summary: "Internal notes for VAT-aware product pricing.",
    author: "Finance Team",
    image: "/demo/blogs/vat.jpg",
  },
] as const;

export const MANAGEMENT_NEWSLETTER_SUBSCRIBERS = [
  { key: "sub1", email: "newsletter.one@boe.demo", status: "subscribed" },
  { key: "sub2", email: "newsletter.two@boe.demo", status: "subscribed" },
  { key: "sub3", email: "newsletter.three@boe.demo", status: "subscribed" },
  { key: "sub4", email: "newsletter.four@boe.demo", status: "unsubscribed" },
  { key: "sub5", email: "newsletter.five@boe.demo", status: "subscribed" },
] as const;

export const MANAGEMENT_NEWSLETTERS = [
  {
    key: "draft",
    title: "New Arrival Draft",
    subject: "New arrivals are almost ready",
    status: "draft",
  },
  {
    key: "scheduled",
    title: "Weekend Offer",
    subject: "Weekend deals from Birds of Eden",
    status: "scheduled",
  },
  {
    key: "sent",
    title: "Launch Announcement",
    subject: "The new collection is live",
    status: "sent",
  },
  {
    key: "promo",
    title: "Coupon Campaign",
    subject: "Use your coupon before it expires",
    status: "draft",
  },
  {
    key: "ops",
    title: "Delivery Update",
    subject: "Delivery improvements this month",
    status: "sent",
  },
] as const;

export const MANAGEMENT_COUPONS = [
  {
    key: "welcome",
    code: "MGMT-WELCOME10",
    discountType: "percentage",
    discountValue: 10,
    minOrderValue: 1000,
    maxDiscount: 300,
    usageLimit: 100,
    usedCount: 12,
    isValid: true,
    expiresInDays: 30,
  },
  {
    key: "flat",
    code: "MGMT-FLAT200",
    discountType: "fixed",
    discountValue: 200,
    minOrderValue: 1500,
    maxDiscount: 200,
    usageLimit: 80,
    usedCount: 8,
    isValid: true,
    expiresInDays: 45,
  },
  {
    key: "ship",
    code: "MGMT-FREESHIP",
    discountType: "free_shipping",
    discountValue: 120,
    minOrderValue: 800,
    maxDiscount: 120,
    usageLimit: 200,
    usedCount: 35,
    isValid: true,
    expiresInDays: 20,
  },
  {
    key: "vip",
    code: "MGMT-VIP15",
    discountType: "percentage",
    discountValue: 15,
    minOrderValue: 3000,
    maxDiscount: 700,
    usageLimit: 50,
    usedCount: 4,
    isValid: true,
    expiresInDays: 60,
  },
  {
    key: "expired",
    code: "MGMT-EXPIRED5",
    discountType: "percentage",
    discountValue: 5,
    minOrderValue: 500,
    maxDiscount: 100,
    usageLimit: 30,
    usedCount: 30,
    isValid: false,
    expiresInDays: -5,
  },
] as const;
