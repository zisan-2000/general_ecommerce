CREATE TABLE "StorePolicyContent" (
  "id" TEXT NOT NULL,
  "kind" VARCHAR(20) NOT NULL,
  "locale" VARCHAR(10) NOT NULL DEFAULT 'en',
  "title" VARCHAR(250) NOT NULL,
  "content" TEXT NOT NULL,
  "category" VARCHAR(100) NOT NULL DEFAULT '',
  "linkUrl" VARCHAR(500),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "effectiveDate" DATE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorePolicyContent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StorePolicyContent_kind_check" CHECK ("kind" IN ('shipping', 'returns', 'privacy', 'faq', 'terms', 'sitemap')),
  CONSTRAINT "StorePolicyContent_sortOrder_check" CHECK ("sortOrder" >= 0)
);
CREATE INDEX "StorePolicyContent_kind_locale_isPublished_sortOrder_idx"
  ON "StorePolicyContent"("kind", "locale", "isPublished", "sortOrder");

-- Preserve existing translated storefront content as editable published records.
INSERT INTO "StorePolicyContent" ("id", "kind", "locale", "title", "content", "category", "linkUrl", "sortOrder", "isPublished") VALUES
('policy_seed_en_shipping_0', 'shipping', 'en', 'Shipping and delivery', 'From order confirmation to doorstep delivery, see how your package moves.', '', NULL, 0, true),
('policy_seed_en_shipping_1', 'shipping', 'en', 'Shipping and delivery', 'Delivery estimate

Shown during checkout

Timing varies by location, inventory and courier coverage.

Secure packaging

Packed with care

Items are prepared to reduce the risk of damage in transit.

Delivery support

Help when needed

Contact us if tracking stalls or the package arrives with an issue.', '', NULL, 1, true),
('policy_seed_en_shipping_2', 'shipping', 'en', 'How your order reaches you', 'Order confirmation

We verify payment, stock and delivery details before processing.

Picking and packing

The correct items are checked and packed securely.

Courier handover

The shipment is assigned to an available delivery partner.

Doorstep delivery

Track progress and inspect the package when it arrives.', '', NULL, 2, true),
('policy_seed_en_shipping_3', 'shipping', 'en', 'Helpful delivery guidance', 'A few simple checks can help avoid delays and make delivery smoother.

Provide a complete address, landmark and reachable phone number.

Treat delivery dates as estimates, especially during holidays or severe weather.

Keep your phone available when the courier contacts you.

Use order tracking or contact support if there is no update for an unusual period.

Check the outer package and report visible damage as soon as possible.

Keep the invoice and packaging until you are satisfied with the product.', '', NULL, 3, true),
('policy_seed_en_returns_4', 'returns', 'en', 'Returns and refunds', 'A clear process for reporting eligible product issues and receiving support.', '', NULL, 0, true),
('policy_seed_en_returns_5', 'returns', 'en', 'Returns and refunds', 'Return window

Request a return within the period shown on the product or order details.

Product condition

Keep the product, accessories, invoice and original packaging together.

Review and resolution

We inspect the request and confirm the appropriate exchange, replacement or refund.', '', NULL, 1, true),
('policy_seed_en_returns_6', 'returns', 'en', 'Eligible return reasons', 'You received a different product or variant.

The product has a verified manufacturing or quality defect.

The product arrived damaged in transit.

Required accessories or parts are missing.', '', NULL, 2, true),
('policy_seed_en_returns_7', 'returns', 'en', 'Usually not eligible', 'Damage caused after delivery through misuse or an accident.

Products that have been altered, repaired or modified without approval.

Requests submitted after the applicable return window.

Products returned without required packaging, accessories or proof of purchase.', '', NULL, 3, true),
('policy_seed_en_returns_8', 'returns', 'en', 'How the return process works', 'Contact support

Share your order number, the issue and clear photos or video when relevant.

Get approval

Our team reviews eligibility and provides the return instructions.

Send or hand over the item

Pack all included items securely and follow the approved handover method.

Receive the resolution

After inspection, we complete the approved replacement, exchange or refund.', '', NULL, 4, true),
('policy_seed_en_returns_9', 'returns', 'en', 'Refund and exchange details', 'Processing time

Usually 5–7 business days after approval and inspection.

Refund method

Refunds are generally returned through the original payment method.

Return shipping

Responsibility depends on the return reason and the approved instructions.

Exchange availability

Exchanges depend on current stock and product eligibility.', '', NULL, 5, true),
('policy_seed_en_privacy_10', 'privacy', 'en', 'Privacy policy', 'Your privacy is important to us.', '', NULL, 0, true),
('policy_seed_en_privacy_11', 'privacy', 'en', 'Privacy policy', 'Data security

Reasonable safeguards are used to protect your information.

Transparency

We explain what information is collected and why it is needed.

Your control

You can review and update available account information.', '', NULL, 1, true),
('policy_seed_en_privacy_12', 'privacy', 'en', 'What we collect', 'Personal information

Name and email address

Phone number

Delivery address

Order information

Product preferences

Order history

Payment method information, excluding sensitive credentials

Usage information

Browsing activity

Wishlist items

Page views

What we do not store

Full bank account details

Full card numbers

Plain-text passwords', '', NULL, 2, true),
('policy_seed_en_privacy_13', 'privacy', 'en', 'How we use your information', 'Essential uses

Order processing and delivery

Account management

Customer support

Relevant product recommendations

With your permission

Marketing emails

Special offers and promotions

New product notifications

Surveys and feedback requests', '', NULL, 3, true),
('policy_seed_en_privacy_14', 'privacy', 'en', 'Your rights', 'Access your information

You can request access to the information we hold about you.

Update information

You can edit available profile details or ask us to correct them.', '', NULL, 4, true),
('policy_seed_en_terms_15', 'terms', 'en', 'Terms and conditions', 'These terms explain how accounts, product orders, payments, fulfilment and after-sales support work when you use this store.

By accessing the store, creating an account or placing an order, you agree to these terms and the linked privacy, shipping and return policies. If you do not agree, do not submit an order.', '', NULL, 0, true),
('policy_seed_en_terms_16', 'terms', 'en', 'Orders and availability', 'Submitting an order is a request to purchase. An order is accepted after stock, price, payment and delivery information have been verified.

Products, variants and warehouse stock can change before confirmation. If an item becomes unavailable, we may offer an alternative, revise the order with your approval or cancel and refund the affected amount.', '', NULL, 1, true),
('policy_seed_en_terms_17', 'terms', 'en', 'Pricing and payment', 'Prices are shown in the displayed currency and may change without notice. The confirmed total includes applicable discounts, taxes and delivery charges shown during checkout.

Payment methods are subject to provider approval. Instalment information, where shown, remains indicative until the provider confirms eligibility, fees and tenure.', '', NULL, 2, true),
('policy_seed_en_terms_18', 'terms', 'en', 'Delivery and inspection', 'Delivery estimates are not guarantees and may be affected by stock location, courier coverage, weather, holidays or events outside our reasonable control.

Inspect the package and product promptly. Report missing, damaged or incorrect items through support within the period stated in the return policy.', '', NULL, 3, true),
('policy_seed_en_terms_19', 'terms', 'en', 'Warranty and product compatibility', 'Warranty coverage depends on the product, brand and provider shown on the product page or invoice. Manufacturer or distributor conditions may apply.

Compatibility information is guidance unless expressly confirmed. Verify relevant model, size, material, specification or usage requirements before purchase.', '', NULL, 4, true),
('policy_seed_en_terms_20', 'terms', 'en', 'Software and digital items', 'Software, activation keys, subscriptions and digital products are governed by their publisher licence terms. Delivered or activated credentials may not be returnable except where legally required or proven defective.

You must not resell, copy, bypass licensing controls or use a digital product outside its permitted licence.', '', NULL, 5, true),
('policy_seed_en_terms_21', 'terms', 'en', 'Accounts and acceptable use', 'Keep account and contact information accurate and protect your credentials. You are responsible for account activity unless unauthorized use is promptly reported.

Automated abuse, fraud, unlawful use, interference with the service, false claims and attempts to access restricted systems are prohibited.', '', NULL, 6, true),
('policy_seed_en_terms_22', 'terms', 'en', 'Cancellations, returns and liability', 'Cancellation and return eligibility follows the order status and published return policy. Refund timing can also depend on the payment provider.

To the extent permitted by applicable law, liability is limited to direct loss connected to the affected order. Rights that cannot legally be excluded remain unaffected.', '', NULL, 7, true),
('policy_seed_en_terms_23', 'terms', 'en', 'Policy changes and contact', 'We may update these terms to reflect operational, legal or service changes. The effective date identifies the current version. Contact support before ordering if any condition is unclear.

Contact support

Read return policy', '', NULL, 8, true),
('policy_seed_en_faq_24', 'faq', 'en', 'What can I buy from this store?', 'Our available range is organized by the live categories shown in the storefront. Browse categories or search the catalog to see what is currently offered.', 'General information', NULL, 0, true),
('policy_seed_en_faq_25', 'faq', 'en', 'How large is your product collection?', 'Our product collection continues to grow and is updated regularly with new arrivals and current inventory.', 'General information', NULL, 1, true),
('policy_seed_en_faq_26', 'faq', 'en', 'How can I confirm product compatibility?', 'Compare the model, interface, dimensions and other requirements in the specifications. Contact support before ordering if compatibility is unclear.', 'General information', NULL, 2, true),
('policy_seed_en_faq_27', 'faq', 'en', 'How do I create an account?', 'Open Login or Sign Up, choose Register, and create an account with your name, email and password.', 'General information', NULL, 3, true),
('policy_seed_en_faq_28', 'faq', 'en', 'Do I need an account to place an order?', 'Guest checkout may be available. An account makes it easier to track orders and use account features.', 'Ordering and payments', NULL, 4, true),
('policy_seed_en_faq_29', 'faq', 'en', 'Which payment methods do you support?', 'Available payment methods appear during checkout and can include mobile payments, cards and cash on delivery.', 'Ordering and payments', NULL, 5, true),
('policy_seed_en_faq_30', 'faq', 'en', 'Can I cancel my order?', 'Cancellation depends on the order status. Open your order details to check the available action or contact support.', 'Ordering and payments', NULL, 6, true),
('policy_seed_en_faq_31', 'faq', 'en', 'Is my payment secure?', 'Checkout uses supported payment providers and secure handling. Sensitive payment credentials are not stored by the store.', 'Ordering and payments', NULL, 7, true),
('policy_seed_en_faq_32', 'faq', 'en', 'How will I receive order confirmation?', 'Confirmation and status updates can appear in your account and may also be sent through configured email or SMS channels.', 'Ordering and payments', NULL, 8, true),
('policy_seed_en_faq_33', 'faq', 'en', 'How much is the delivery charge?', 'The delivery charge depends on the delivery area, cart and current shipping rules. The final amount is shown at checkout.', 'Delivery and shipping', NULL, 9, true),
('policy_seed_en_faq_34', 'faq', 'en', 'How long does delivery take?', 'The estimate depends on inventory location, destination and courier coverage and is shown during checkout or order processing.', 'Delivery and shipping', NULL, 10, true),
('policy_seed_en_faq_35', 'faq', 'en', 'Where do you deliver?', 'Delivery availability depends on the active courier coverage and the address entered during checkout.', 'Delivery and shipping', NULL, 11, true),
('policy_seed_en_faq_36', 'faq', 'en', 'How can I track my order?', 'Open My Orders and select the order to see its current status and available shipment tracking.', 'Delivery and shipping', NULL, 12, true),
('policy_seed_en_faq_37', 'faq', 'en', 'Do you offer express delivery?', 'Express or faster delivery may appear when supported for the selected address and order.', 'Delivery and shipping', NULL, 13, true),
('policy_seed_en_faq_38', 'faq', 'en', 'Can I return a product?', 'Eligible products can be returned within the applicable window for supported reasons such as damage, defects or an incorrect item.', 'Returns and refunds', NULL, 14, true),
('policy_seed_en_faq_39', 'faq', 'en', 'How does the refund process work?', 'After approval, return and inspection, the refund is issued through the approved method. Provider processing times may vary.', 'Returns and refunds', NULL, 15, true),
('policy_seed_en_faq_40', 'faq', 'en', 'Can I exchange a product?', 'An exchange may be available depending on the return reason, product eligibility and current stock.', 'Returns and refunds', NULL, 16, true),
('policy_seed_en_faq_41', 'faq', 'en', 'What should I do if I forgot my password?', 'Use Forgot Password on the login page, enter your registered email and follow the reset instructions.', 'Account and profile', NULL, 17, true),
('policy_seed_en_faq_42', 'faq', 'en', 'How do I update my profile?', 'Open your account profile to update the available personal and contact information.', 'Account and profile', NULL, 18, true),
('policy_seed_en_faq_43', 'faq', 'en', 'How can I view my order history?', 'Open My Account and select My Orders to view current and previous purchases.', 'Account and profile', NULL, 19, true),
('policy_seed_en_faq_44', 'faq', 'en', 'How do I manage saved addresses?', 'Open the address section in your account to add, edit or remove saved delivery addresses.', 'Account and profile', NULL, 20, true),
('policy_seed_en_faq_45', 'faq', 'en', 'How do I know whether a product is in stock?', 'The product page shows its current availability. Stock can change until an order is confirmed.', 'Products and availability', NULL, 21, true),
('policy_seed_en_faq_46', 'faq', 'en', 'Do product prices change?', 'Prices and promotions may change. The confirmed checkout total is the price that applies to the submitted order.', 'Products and availability', NULL, 22, true),
('policy_seed_en_faq_47', 'faq', 'en', 'Where can I find specifications?', 'Open the product page and review its description, attributes, variants and specification sections.', 'Products and availability', NULL, 23, true),
('policy_seed_en_faq_48', 'faq', 'en', 'Can I compare products?', 'Use available categories, filters and product details to compare options, or contact support for guidance.', 'Products and availability', NULL, 24, true),
('policy_seed_en_sitemap_49', 'sitemap', 'en', 'Shipping Policy', '', '', '/ecommerce/shipping', 0, true),
('policy_seed_en_sitemap_50', 'sitemap', 'en', 'Return Policy', '', '', '/ecommerce/returns', 1, true),
('policy_seed_en_sitemap_51', 'sitemap', 'en', 'Privacy Policy', '', '', '/ecommerce/privacy', 2, true),
('policy_seed_en_sitemap_52', 'sitemap', 'en', 'FAQ', '', '', '/ecommerce/faq', 3, true),
('policy_seed_en_sitemap_53', 'sitemap', 'en', 'Terms of Service', '', '', '/ecommerce/terms', 4, true),
('policy_seed_bn_shipping_54', 'shipping', 'bn', 'জাহাজ চলাচল এবং বিতরণ', 'হোভার্ট ডেলিভারি নিশ্চিত করার জন্য, আপনার প্যাকেজ কিভাবে চালাবে তা দেখুন।', '', NULL, 0, true),
('policy_seed_bn_shipping_55', 'shipping', 'bn', 'জাহাজ চলাচল এবং বিতরণ', 'বিতরণ সংক্রান্ত পরিমাণ

চিহ্নিত সময়ে প্রদর্শিত হবে

টিমিং এর অবস্থান, আবিষ্কারী এবং বিশ্লেষণ।

নিরাপদ প্যাকেজ

যত্ন সঙ্গে প্যাক

যাত্রাপথে ক্ষতিগ্রস্ত হওয়ার ঝুঁকি কমানোর জন্য বস্তু প্রস্তুত করা হয়েছে।

বিতরণ সংক্রান্ত সহায়তা

যখন প্রয়োজন

আমাদের সাথে যোগাযোগ করুন যদি ট্রাকিং স্টল বা প্যাকেজ কোন সমস্যা নিয়ে আসে।', '', NULL, 1, true),
('policy_seed_bn_shipping_56', 'shipping', 'bn', 'আপনার নির্দেশ অনুযায়ী', 'নিশ্চিত করা হবে

আমরা পেমেন্ট, স্টক আর ডেলিভারির তথ্য পরীক্ষা করবো।

প্যাকিং এবং প্যাকিং

সঠিক বস্তু বানান পরীক্ষা করে আন-লক করা হয়েছে ।

কনসেইয়ার হ্যান্ডার

এই চালান একটি প্রাপ্তিসাধ্য সরবরাহকৃত পার্টনারের জন্য বরাদ্দ করা হয়।

দরজা চালু করো

আপডেট সঞ্চালনার সময় প্যাকেজটি পরীক্ষা করুন ও অনুসরণ করুন।', '', NULL, 2, true),
('policy_seed_bn_shipping_57', 'shipping', 'bn', 'সাহায্য সংক্রান্ত সহায়িকা', '[ অধ্যয়ন প্রশ্নাবলি]

একটি পূর্ণ ঠিকানা, পরিচয় পত্র এবং টেলিফোন নম্বর সরবরাহ করো।

কিছু কিছু দেশে, বিশেষ করে ছুটি বা কঠিন আবহাওয়ার সময় ।

যখন আপনি আপনার সঙ্গে যোগাযোগ করেন, তখন আপনার ফোন রাখুন ।

কোনো ধরনের আপডেট উপস্থিত না থাকলে, কোনো সুনির্দিষ্ট সময় নিরীক্ষণের ব্যবস্থা প্রয়োগ করা হবে।

প্রয়োজনীয় প্যাকেজ এবং প্রতিবেদন যত দ্রুত সম্ভব সম্ভব এটি চেক করুন।

পানি নিয়ে সন্তুষ্ট না হওয়া পর্যন্ত ভয়েস এন্ড প্যাকেজিং এ রাখুন।', '', NULL, 3, true),
('policy_seed_bn_returns_58', 'returns', 'bn', 'পুনরুদ্ধার এবং প্রতিসান্ড', 'যোগ্য পণ্যের বিষয়ে রিপোর্ট এবং সমর্থনের জন্য একটি পরিষ্কার প্রক্রিয়া।', '', NULL, 0, true),
('policy_seed_bn_returns_59', 'returns', 'bn', 'পুনরুদ্ধার এবং প্রতিসান্ড', 'উইন্ডোর মাপ বৃদ্ধি করুন

ফলাফল অথবা অনুক্রমের মধ্যে প্রদর্শনের পূর্বে পুনরায় অনুরোধ করা হবে।

উৎপাদন

পণ্যগুলো রাখতে থাকুন।

পর্যালোচনা ও পরিচালনা

আমরা অনুরোধটা পরীক্ষা করে দেখি এবং সঠিক বিনিময়, প্রতিস্থাপন বা পরিশোধনের ব্যাপারে নিশ্চিত হই।', '', NULL, 1, true),
('policy_seed_bn_returns_60', 'returns', 'bn', '( ১ করি.', 'আপনি বিভিন্ন পণ্য বা রূপভেদ পেয়েছেন।

এই পণ্যের একটি যাচাইসাধন বা মানসম্মত ত্রুটি রয়েছে।

পণ্যটি ট্রানজিট করে নষ্ট হয়েছে।

কিন্তু কম্পোনেন্টের কোন অংশ পাওয়া যাচ্ছে না।', '', NULL, 2, true),
('policy_seed_bn_returns_61', 'returns', 'bn', '% 1 বছর', 'অপব্যবহার অথবা দুর্ঘটনার পর ক্ষতি হয়েছে।

যে সমস্ত পণ্য পরিবর্তন করা হয়েছে, সেগুলো অনুমোদন ছাড়াই মেরামত বা পরিবর্তিত হয়েছে।

আবেদন করার পরে জমা দেওয়া হবে ।

প্রয়োজনীয় প্যাকেজ ছাড়া পণ্যগুলো আবার ফিরে এসেছে, একটি বিজ্ঞাপন বা ক্রয়পত্র ছাড়া।', '', NULL, 3, true),
('policy_seed_bn_returns_62', 'returns', 'bn', 'ফিরে আসা প্রক্রিয়া যেভাবে কাজ করে', 'পরিচিতির সমর্থন

আপনার অর্ডার নাম্বার শেয়ার করুন, বিষয়টি পরিষ্কার করুন এবং প্রাসঙ্গিক সময়ে ভিডিও অথবা ভিডিও করুন।

অনুমোদন প্রাপ্ত করুন

আমাদের দল ইলিজিকাল পর্যালোচনা করে ফিরে আসার নির্দেশনা দিয়েছে।

বস্তু প্রেরণ করুন অথবা টেনে নিন

সকল উপাদানের মধ্যে রয়েছে নিরাপদ এবং অনুমোদিত পদ্ধতি অনুসরণ করুন।

প্রস্থের রেজল্যুশন গ্রহণ করুন

পরীক্ষা করার পর, আমরা অনুমোদিত প্রতিস্থাপন সম্পূর্ণ করেছি, বিনিময় অথবা পরিশোধন ব্যবস্থা সম্পূর্ণ করেছি।', '', NULL, 4, true),
('policy_seed_bn_returns_63', 'returns', 'bn', 'Refund ও বিনিময় সংক্রান্ত বিবরণ', 'প্রক্রিয়াকরণের সময়:

সাধারণত ৫-৭ দিন অনুমতি এবং পরীক্ষা করার পর।

অঙ্কন পদ্ধতি

সাধারণত মূল পেমেন্টের মাধ্যমে ঋণ পরিশোধ করা হয়।

প্রস্থান জাহাজ

দায়িত্ব ফিরে আসার কারণ এবং অনুমোদিত নির্দেশনার উপর নির্ভর করে।

Exchange-র কর্মক্ষমতা উপলব্ধ নেই

বর্তমান স্টক এবং পণ্যের উপর এক্সচেঞ্জ নির্ভর করে।', '', NULL, 5, true),
('policy_seed_bn_privacy_64', 'privacy', 'bn', 'ব্যক্তিগত তথ্যের নীতিমালা', 'তোমার গোপনীয়তা আমাদের কাছে গুরুত্বপূর্ণ।', '', NULL, 0, true),
('policy_seed_bn_privacy_65', 'privacy', 'bn', 'ব্যক্তিগত তথ্যের নীতিমালা', 'সুরক্ষা সংক্রান্ত তথ্য

আপনার তথ্য রক্ষা করার জন্য যুক্তিযুক্ত সুরক্ষা ব্যবহৃত হয় ।

স্বচ্ছতা

আমরা ব্যাখ্যা করি যে, কী তথ্য সংগ্রহ করা হয়েছে এবং কেন তা প্রয়োজন ।

আপনার নিয়ন্ত্রণ

আপনি এই অ্যাকাউন্ট সংক্রান্ত তথ্য পর্যালোচনা ও আপডেট করতে পারবেন।', '', NULL, 1, true),
('policy_seed_bn_privacy_66', 'privacy', 'bn', 'আমরা যা সংগ্রহ করি', 'ব্যক্তিগত তথ্য

ই-মেইল ঠিকানা ( A):

ফোন নম্বর

মেইল হেডারের ঠিকানা

তথ্য

উৎপাদন সংক্রান্ত পছন্দ

পূর্ববর্তী তথ্য

সংবেদনশীল তথ্য প্রদান, সংবেদনশীল তথ্যের গণনা করুন

ব্যবহার সংক্রান্ত তথ্য

ব্রাউজের কর্ম সঞ্চালনার প্রণালী

সংযুক্ত বস্তু

পৃষ্ঠা প্রদর্শন

আমরা কি সংরক্ষণ না

আপনার অ্যাকাউন্টের বিস্তারিত তথ্য লিখুন

সম্পূর্ণ কার্ড সংখ্যা

প্লেইন-টেক্সট পাসওয়ার্ড', '', NULL, 2, true),
('policy_seed_bn_privacy_67', 'privacy', 'bn', 'কিভাবে আমরা আপনার তথ্য ব্যবহার করব', 'অপরিহার্য ব্যবহার

চালু এবং প্রদান করুন

অ্যাকাউন্ট নিয়ন্ত্রন

গ্রাহক সমর্থন

[ পাদটীকা]

আপনার অনুমতির মাধ্যমে

ব্যবসায়িক ই-মেইল

বিশেষ প্রস্তাব আর পদোন্নতি

নতুন পণ্যের বিজ্ঞপ্তি

জরিপ এবং প্রতিক্রিয়া অনুরোধ', '', NULL, 3, true),
('policy_seed_bn_privacy_68', 'privacy', 'bn', 'আপনার অধিকার', 'আপনার তথ্য ব্যবহার করুন

আপনার সম্পর্কে তথ্য জানার জন্য আপনি অনুরোধ করতে পারেন।

আপডেট সংক্রান্ত তথ্য

প্রোফাইল সম্পর্কিত তথ্য সম্পাদন করতে, অথবা তাদের সংশোধন করতে অনুরোধ করুন।', '', NULL, 4, true),
('policy_seed_bn_terms_69', 'terms', 'bn', 'সময়কাল ও অবস্থা', 'এই শব্দগুলো ব্যাখ্যা করে কি ভাবে অ্যাকাউন্ট, পণ্যের নির্দেশ, চুক্তি, চুক্তি, চুক্তি, চুক্তি এবং ঋণ গ্রহণ, এবং যখন আপনি DECOPACHING ব্যবহার করেন, তখন কি ভাবে সাহায্য করা যায়।

দোকান ব্যবহার করে, অ্যাকাউন্ট তৈরি অথবা একটি আদেশ স্থাপন করার মাধ্যমে, আপনি এই শর্তের সাথে একমত এবং যুক্ত গোপনীয়তা, জাহাজ চলাচল এবং ফিরে নীতির সাথে একমত। ( হিতো.', '', NULL, 0, true),
('policy_seed_bn_terms_70', 'terms', 'bn', 'আদেশ ও হিসাব', 'একটা আদেশ প্রদান করা হচ্ছে ক্রয়ের অনুরোধ। শেয়ার, দাম, টাকা এবং সরবরাহের তথ্য যাচাই করা হয়েছে।

প্রসাধন, স্টাইল আর গুদাম স্টক ঠিক আগে পরিবর্তন করতে পারে। যদি কোনো বস্তু পাওয়া না যায়, তাহলে আমরা হয়তো বিকল্প ব্যবস্থা করতে পারি, যাতে অনুমতি দেওয়া হয় অথবা বাতিল করে দেওয়া হয় ।', '', NULL, 1, true),
('policy_seed_bn_terms_71', 'terms', 'bn', 'অর্থ এবং দান', 'মুদ্রার দাম প্রদর্শন করা হয় এবং কোন নোটিশ ছাড়াই পরিবর্তন হতে পারে। এই বিষয়টি নিশ্চিত করা হয়েছে যে চেকআউট-এর সময় এই সমস্ত অভিযোগ তুলে ধরা হয়েছে, কর প্রদান এবং সরবরাহের জন্য যে সমস্ত অভিযোগ প্রদান করা হয়েছে, সেগুলোর মধ্যে রয়েছে।

প্রদানকৃত অনুমোদন প্রদান করা হয়। তথ্য, যেখানে তথ্য, সেখানে প্রদর্শন করা হয় যতক্ষণ না সরবরাহকারী ইলিজিলিকাল, ফি এবং দশ শতাংশ নিশ্চিত না করে।', '', NULL, 2, true),
('policy_seed_bn_terms_72', 'terms', 'bn', 'বিতরণ এবং অনুসন্ধান', 'বিতরণের হিসেব অনুসারে কোন নিশ্চয়তা নেই এবং স্টকের স্থান দ্বারা আক্রান্ত হতে পারে।

প্যাকেজ এবং পণ্য দ্রুত চেক করুন। ফেরত দেওয়া তথ্য অনুপস্থিত বা ভুল উপাদান ফিরে আসার নীতি অনুসারে সুনির্দিষ্ট অথবা ভুল উপাদান।', '', NULL, 3, true),
('policy_seed_bn_terms_73', 'terms', 'bn', '[ অধ্যয়ন প্রশ্নাবলি]', 'সরবরাহকৃত এই সংবাদ পণ্যের পণ্য, ব্র্যান্ড এবং সরবরাহকারীর উপর নির্ভর করে। কা. পূ.

( ১ করি. কেনার আগে প্রাসঙ্গিক মডেল, মাপ, বিষয়বস্তু, সুনির্দিষ্ট তথ্য অথবা ব্যবহার করুন ।', '', NULL, 4, true),
('policy_seed_bn_terms_74', 'terms', 'bn', 'সফ্টওয়্যার এবং ডিজিটাল বস্তু', 'সফ্টওয়্যার, সক্রিয়করণ, সাবস্ক্রিপশন এবং ডিজিটাল পণ্য তাদের প্রকাশক লাইসেন্স দ্বারা পরিচালিত হয়। প্রেরিত অথবা সক্রিয় পরিচয় বিনা অনুমোদন ব্যবস্থা পুনরায় চালু করা সম্ভব হবে না, যেখানে আইনত অথবা প্রমাণিত সমস্যা ছাড়া সেখানে ফেরত পাঠানো যাবে না।

লাইসেন্সের মাধ্যমে আপনি যে ডিজিটাল পণ্য ব্যবহার করতে পারেন, কপি, লাইসেন্সের মাধ্যমে তা পুনরায় প্রকাশ করতে হবে না।', '', NULL, 5, true),
('policy_seed_bn_terms_75', 'terms', 'bn', 'অ্যাকাউন্ট এবং গ্রহণযোগ্যতা', 'আপনার অ্যাকাউন্ট এবং তথ্য রক্ষা করুন। আপনি দায়ী, যদি না অনুমতি না দেয়া হয় তবে আপনি এই কাজের জন্য দায়ী।

( মথি ২৪: ১৪; ২৮: ১৯, ২০, ২১; যোহন ৫: ২৮, ২৯; প্রেরিত ৫: ২৮, ২৯; ১ যোহন ৫: ১৯) অটোগ্রাফ ব্যবহার করা, অবৈধ ব্যবহার, সেবার সাথে হস্তক্ষেপ, মিথ্যা দাবি এবং সীমিত সংখ্যক প্রবেশ পদ্ধতি নিষিদ্ধ করা নিষেধ ।', '', NULL, 6, true),
('policy_seed_bn_terms_76', 'terms', 'bn', 'বাতিল, প্রত্যাবর্তন ও স্থানান্তর', 'বাতিল এবং ফিরে এসে এই আদেশ পালন করে আবার ফিরে আসার আদেশ প্রদান করা হয়। রেফ্রিন্ড টাইমমেন্ট সার্ভিসের উপরও নির্ভর করতে পারে।

অনুমোদিত আইন মেনে চলায় আক্রান্তদের সাথে সরাসরি সংযোগ বিচ্ছিন্ন করা যায় না। যে অধিকার আইনতভাবে বাদ দেয়া যাবে না তা অবিকৃতকার্য হবে না।', '', NULL, 7, true),
('policy_seed_bn_terms_77', 'terms', 'bn', 'পলিসি এবং পরিচিতি পরিবর্তন করা হবে', 'আমরা কাজ, আইনী অথবা সেবা পরিবর্তনকে প্রতিফলিত করার জন্য এই শব্দগুলোকে আপডেট করতে পারি । সাম্প্রতিক সংস্করণগুলি সনাক্ত করতে এই তারিখটি ব্যবহৃত হয়। পুনরায় নিশ্চিত না হলে, তার নিকটবর্তী অবস্থায় পরিচয় প্রমাণ করার পূর্বে পরিচিতির সমর্থন করুন।

পরিচিতির সমর্থন

চিহ্নিত নীতি পড়ুন', '', NULL, 8, true),
('policy_seed_bn_faq_78', 'faq', 'bn', 'আমি এই দোকান থেকে কি কিনতে পারি?', 'দোকানের সামনে সরাসরি প্রদর্শিত লাইভ ক্লাসগুলো আমাদের প্রাপ্তিসাধ্য। সিস্টেমের বৈশিষ্ট্য অনুসন্ধান অথবা পর্যবেক্ষণ করুন ।', 'সাধারণ তথ্য', NULL, 0, true),
('policy_seed_bn_faq_79', 'faq', 'bn', 'আপনার পণ্যের দাম কত?', 'আমাদের পণ্য সংগ্রহের কাজ বেড়েই চলছে এবং নিয়মিতভাবে নতুন আগমন এবং বর্তমান আবিষ্কারক হিসেবে তাজা সংবাদ প্রদান করা হচ্ছে।', 'সাধারণ তথ্য', NULL, 1, true),
('policy_seed_bn_faq_80', 'faq', 'bn', 'আমি কিভাবে নিশ্চিত করতে পারি?', 'মডেল, ইন্টারফেস, মাত্রা এবং অন্যান্য প্রয়োজন অনুসারে নির্ধারিত। সুসংগতির উদ্দেশ্যে নেটওয়ার্ক সমর্থনের পূর্বে পরিচয় প্রমাণ করা হবে কি না।', 'সাধারণ তথ্য', NULL, 2, true),
('policy_seed_bn_faq_81', 'faq', 'bn', 'আমি কিভাবে একটা অ্যাকাউন্ট তৈরি করব?', 'লগ-ইন করুন অথবা স্বাক্ষর করুন, নিবন্ধন করার জন্য আপনার নাম, ই-মেইল ও পাসওয়ার্ড লিখুন।', 'সাধারণ তথ্য', NULL, 3, true),
('policy_seed_bn_faq_82', 'faq', 'bn', 'আমার কি একটা অ্যাকাউন্ট লাগবে ?', 'অতিথির চেক এখান থেকে পাওয়া যাচ্ছে না। একটা হিসাব অ্যাকাউন্ট অ্যাকাউন্টের বৈশিষ্ট্য অনুসরণ করা ও তা ব্যবহার করা সহজ করে ।', 'অর্ডার এবং অর্থ প্রদান', NULL, 4, true),
('policy_seed_bn_faq_83', 'faq', 'bn', 'কোন পদ্ধতিতে আপনি সমর্থন করেন?', 'চেকআউটের সময় পাওয়া যাচ্ছে যে, পেমেন্টের মাধ্যমে পাওয়া অর্থ, কার্ড এবং অর্থ প্রদান করা যাবে।', 'অর্ডার এবং অর্থ প্রদান', NULL, 5, true),
('policy_seed_bn_faq_84', 'faq', 'bn', 'আমি কি আমার আদেশ বাতিল করতে পারি?', 'বাতিল করা হয়েছে নির্দেশের উপর নির্ভর করে। উপলব্ধ কর্ম সম্পর্কে তথ্য অনুসন্ধানের জন্য, ব্যক্তিগত ডিরেক্টরি দেখুন অথবা পরিচিতি প্রয়োগ করুন।', 'অর্ডার এবং অর্থ প্রদান', NULL, 6, true),
('policy_seed_bn_faq_85', 'faq', 'bn', 'আমার পেমেন্ট কি নিরাপদ?', 'লক্ষ্য রাখা স্টোর দ্বারা সংবেদনশীল তথ্য সংরক্ষণ করা হয়নি।', 'অর্ডার এবং অর্থ প্রদান', NULL, 7, true),
('policy_seed_bn_faq_86', 'faq', 'bn', 'আমি কিভাবে নিশ্চিত হব?', 'অনুমোদন এবং অবস্থা আপডেট করা যাবে আপনার অ্যাকাউন্টের মাধ্যমে, এবং ই-মেইল অথবা এসএমএস চ্যানেলের মাধ্যমে।', 'অর্ডার এবং অর্থ প্রদান', NULL, 8, true),
('policy_seed_bn_faq_87', 'faq', 'bn', 'ডেলিভারির দাম কত?', 'ডেলিভারমেন্টের চার্জ ডেলিভারির এলাকা, কার্ট আর বর্তমান জাহাজের নিয়মের উপর নির্ভর করে। চেক আউটে শেষ পরিমাণ দেখা যাচ্ছে।', 'বিতরণ এবং জাহাজ', NULL, 9, true),
('policy_seed_bn_faq_88', 'faq', 'bn', 'আর কত সময় লাগবে?', 'ধারণা করা হয় যে সাজানোর স্থান, গন্তব্যস্থল এবং স্থান দখলের উপর নির্ভর করে এবং চেকআউট বা অর্ডারের সময় প্রদর্শন করা হয়।', 'বিতরণ এবং জাহাজ', NULL, 10, true),
('policy_seed_bn_faq_89', 'faq', 'bn', 'আপনি কোথায় উদ্ধার করবেন?', 'শেয়ারের উপর নির্ভর করে সক্রিয় সহায়তার উপর এবং চেকআউটে প্রবেশের সময় ঠিকানার উপর।', 'বিতরণ এবং জাহাজ', NULL, 11, true),
('policy_seed_bn_faq_90', 'faq', 'bn', 'আমি কিভাবে আমার আদেশ অনুসরণ করতে পারি?', 'আমার অর্ডার খুলুন এবং তার বর্তমান অবস্থা এবং উপলব্ধ চালান অনুসরণ করুন।', 'বিতরণ এবং জাহাজ', NULL, 12, true),
('policy_seed_bn_faq_91', 'faq', 'bn', 'তুমি কি ডেলিভারির প্রস্তাব দাও?', 'নির্বাচিত ঠিকানা ও বৈশিষ্ট্যের জন্য উপলব্ধ হওয়ার সময় দ্রুত বন্টন করা হবে।', 'বিতরণ এবং জাহাজ', NULL, 13, true),
('policy_seed_bn_faq_92', 'faq', 'bn', 'আমি কি পণ্য নিতে পারি?', 'ক্ষতি, দলত্যাগ বা ভুল বস্তু হিসাবে সমর্থিত কারণের ক্ষেত্রে প্রযোজ্য উইন্ডোর মধ্যে গ্রহণযোগ্য সামগ্রী প্রত্যাবর্তন করা যাবে ।', 'পুনরুদ্ধার এবং প্রতিসান্ড', NULL, 14, true),
('policy_seed_bn_faq_93', 'faq', 'bn', 'PHod প্রক্রিয়া কীভাবে কাজ করে?', 'অনুমোদন লাভের পর ফিরে এসে যাচাই করে দেখা, অনুমোদিত পদ্ধতির মাধ্যমে রিসাইকেলটি জারি করা হয়। উপলব্ধকারী প্রসেস করতে ব্যর্থ ।', 'পুনরুদ্ধার এবং প্রতিসান্ড', NULL, 15, true),
('policy_seed_bn_faq_94', 'faq', 'bn', 'আমি কি পণ্য বিনিময় করতে পারি?', 'কোনো বিনিময় হয়তো ফিরে আসার কারণ, পণ্য ফিজিসিটি এবং বর্তমান স্টকের উপর নির্ভর করে।', 'পুনরুদ্ধার এবং প্রতিসান্ড', NULL, 16, true),
('policy_seed_bn_faq_95', 'faq', 'bn', 'আমার পাসওয়ার্ড ভুলে গেলে আমি কি করবো?', 'লগ- ইনের জন্য পাসওয়ার্ড উল্লেখ করো ।', 'অ্যাকাউন্ট এবং প্রোফাইল', NULL, 17, true),
('policy_seed_bn_faq_96', 'faq', 'bn', 'আমার প্রোফাইল কিভাবে আপডেট করবো?', 'উপলব্ধ ব্যক্তিগত তথ্য ও পরিচিতি আপডেট করার জন্য আপনার অ্যাকাউন্ট সংক্রান্ত তথ্য খুলুন।', 'অ্যাকাউন্ট এবং প্রোফাইল', NULL, 18, true),
('policy_seed_bn_faq_97', 'faq', 'bn', '( গীত.', 'আমার অ্যাকাউন্ট খুলুন এবং আমার অর্ডার নির্বাচন করুন বর্তমান এবং আগের ক্রয়।', 'অ্যাকাউন্ট এবং প্রোফাইল', NULL, 19, true),
('policy_seed_bn_faq_98', 'faq', 'bn', 'কিভাবে আমি ঠিকানা পরিচালনা করব?', 'যোগ করুন আপনার অ্যাকাউন্টের তথ্য সম্পাদনা অথবা সংরক্ষণ করুন।', 'অ্যাকাউন্ট এবং প্রোফাইল', NULL, 20, true),
('policy_seed_bn_faq_99', 'faq', 'bn', 'আমি কিভাবে জানবো স্টকে কোন পণ্য আছে কিনা?', 'প্রোডাক্ট পৃষ্ঠা তার বর্তমান ক্ষমতা দেখায়। কোন আদেশ না পাওয়া পর্যন্ত স্টক পরিবর্তন করতে পারে।', 'উৎপাদনের সুবিধা ওতা', NULL, 21, true),
('policy_seed_bn_faq_100', 'faq', 'bn', 'পণ্যের দাম কি পরিবর্তন হয়?', 'মূল্য আর পদোন্নতি পরিবর্তন হতে পারে। নিশ্চিতকরণ চেকআউটটি জমা দেয়ার জন্য মোট মূল্য।', 'উৎপাদনের সুবিধা ওতা', NULL, 22, true),
('policy_seed_bn_faq_101', 'faq', 'bn', 'আমি কোথায় নির্ধারণ করতে পারি?', 'পণ্য পৃষ্ঠা খুলুন এবং এর বর্ণনা, বৈশিষ্ট্য এবং সুনির্দিষ্ট বিভাগগুলো পর্যালোচনা করুন।', 'উৎপাদনের সুবিধা ওতা', NULL, 23, true),
('policy_seed_bn_faq_102', 'faq', 'bn', 'আমি কি পণ্যের তুলনা করতে পারি?', 'উপলব্ধ শ্রেণীবিভাগ, ফিল্টার ও পণ্যের বিস্তারিত বিবরণ ব্যবহার করুন।', 'উৎপাদনের সুবিধা ওতা', NULL, 24, true),
('policy_seed_bn_sitemap_103', 'sitemap', 'bn', 'শিপিং নীতিমালা', '', '', '/ecommerce/shipping', 0, true),
('policy_seed_bn_sitemap_104', 'sitemap', 'bn', 'রিটার্ন নীতিমালা', '', '', '/ecommerce/returns', 1, true),
('policy_seed_bn_sitemap_105', 'sitemap', 'bn', 'গোপনীয়তা নীতিমালা', '', '', '/ecommerce/privacy', 2, true),
('policy_seed_bn_sitemap_106', 'sitemap', 'bn', 'সাধারণ প্রশ্ন', '', '', '/ecommerce/faq', 3, true),
('policy_seed_bn_sitemap_107', 'sitemap', 'bn', 'সেবার শর্তাবলি', '', '', '/ecommerce/terms', 4, true),
('policy_seed_zh_shipping_108', 'shipping', 'zh', '运输和交货', '从订单确认到门阶交付, 看看您的包裹如何移动。', '', NULL, 0, true),
('policy_seed_zh_shipping_109', 'shipping', 'zh', '运输和交货', '交付估计数

退出时显示

时间安排因地点、库存和信使覆盖范围而异。

安全包装

收拾好东西

物品的准备是为了减少运输中损害的风险。

交付支助

需要时的帮助

追踪摊位或者包裹有问题就联系我们', '', NULL, 1, true),
('policy_seed_zh_shipping_110', 'shipping', 'zh', '你的命令是怎么达到你的', '命令确认

我们在处理之前核实付款、库存和交货详情。

采摘和包装

对正确的物品进行安全检查和包装。

库里尔移交

货物交给一个可用的交货伙伴。

门阶交付

跟踪进度,并在包裹到达时检查.', '', NULL, 2, true),
('policy_seed_zh_shipping_111', 'shipping', 'zh', '帮助交付指导', '一些简单的检查可以帮助避免延误,使交付更加平滑.

提供完整的地址,地标和可接触到的电话号码.

将分娩日期作为估计,特别是在节假日或恶劣天气期间。

当信使联系你时 保持您的手机可用。

如果异常时期没有更新,则使用命令跟踪或联系支持.

检查外包并尽快报告明显损坏.

保留发票和包装,直到对产品满意为止.', '', NULL, 3, true),
('policy_seed_zh_returns_112', 'returns', 'zh', '回返和退款', '报告合格产品问题和获得支持的明确程序。', '', NULL, 0, true),
('policy_seed_zh_returns_113', 'returns', 'zh', '回返和退款', '返回窗口

要求在产品或订单细节所示的期限内返回。

产品条件

将产品,附件,发票和原包装物放在一起.

审查和解决

我们检查请求,确认适当的交换、替换或退款。', '', NULL, 1, true),
('policy_seed_zh_returns_114', 'returns', 'zh', '符合条件的返回理由', '你收到了不同的产品或变体。

该产品有经过核实的制造或质量缺陷.

产品运抵途中受损.

缺少必要的附件或部件。', '', NULL, 2, true),
('policy_seed_zh_returns_115', 'returns', 'zh', '通常没有资格', '分娩后因滥用或事故而造成的损害。

未经批准而改变,修理或者修改的产品.

在适用的返回窗口后提交请求。

退回的产品不需要包装、附件或购买证明。', '', NULL, 3, true),
('policy_seed_zh_returns_116', 'returns', 'zh', '回返进程如何运作', '联系支助

共享您的订单号, 发行和清晰的照片或视频 。

获得批准

我们的团队审查资格 并提供返回指示。

发送或移交项目

安全地包装所有物品,并遵循核准的移交方法。

收到决议

检查后,我们完成批准的替换,交换或退款.', '', NULL, 4, true),
('policy_seed_zh_returns_117', 'returns', 'zh', '退款和汇兑细目', '处理时间

通常在批准和检查后5-7个工作日。

退款方法

退款一般通过原付款法返还.

运回

责任取决于返回的理由和核准的指示。

交换可用性

交易所取决于目前的股票和产品资格。', '', NULL, 5, true),
('policy_seed_zh_privacy_118', 'privacy', 'zh', '隐私政策', '你的隐私对我们很重要', '', NULL, 0, true),
('policy_seed_zh_privacy_119', 'privacy', 'zh', '隐私政策', '数据安全

合理保障措施用于保护您的信息。

透明度

我们解释收集了什么信息以及为什么需要这些信息。

你来控制

您可以审查并更新可用的账户信息。', '', NULL, 1, true),
('policy_seed_zh_privacy_120', 'privacy', 'zh', '我们收集的', '个人资料

姓名和电子邮件地址

电话号码

发送地址

顺序信息

产品偏好

顺序历史

付款方法信息,不包括敏感的全权证书

使用信息

浏览活动

清单项目

页面视图

我们不储存的东西

完整的银行账户细节

全卡号码

纯文本密码', '', NULL, 2, true),
('policy_seed_zh_privacy_121', 'privacy', 'zh', '我们如何利用你的信息', '必要用途

处理和交付订单

账户管理

客户支助

相关产品建议

经你许可

营销电子邮件

特别邀请和升级

新产品通知

调查和反馈要求', '', NULL, 3, true),
('policy_seed_zh_privacy_122', 'privacy', 'zh', '你的权利', '获取您的信息

你可以请求访问 我们掌握的关于你的信息。

最新资料

您可以编辑可用的配置文件细节或要求我们改正它们 。', '', NULL, 4, true),
('policy_seed_zh_terms_123', 'terms', 'zh', '条款和条件', '这些术语解释了当您使用this store时,如何进行账户,产品订单,支付,完成和售后支持工作.

通过访问商店,创建账户或发布订单,你同意这些术语以及相关的隐私,航运和回程政策. 不同意的,不要提交命令.', '', NULL, 0, true),
('policy_seed_zh_terms_124', 'terms', 'zh', '命令和可用性', '提交订单是购买请求。 在核实了库存、价格、付款和交货信息之后接受订单。

产品,变种和仓储在确认前可以变更. 如果某物品无法提供,我们可提供替代方案,经你批准修改命令,或取消并退还所涉金额。', '', NULL, 1, true),
('policy_seed_zh_terms_125', 'terms', 'zh', '定价和付款', '价格以显示的货币显示,可不经通知而变动。 已确认的总额包括离职期间适用的折扣、税款和交货费。

付款方法须经供应商批准。 所显示的批次信息在提供者确认资格、收费和保有权之前仍然是指示性的。', '', NULL, 2, true),
('policy_seed_zh_terms_126', 'terms', 'zh', '交付和检查', '交货估计数不是保证,可能受到库存地点、信使范围、天气、假日或超出我们合理控制的事件的影响。

及时检查包和产品. 报告在返回政策规定的期限内通过支助丢失、损坏或不正确的物品。', '', NULL, 3, true),
('policy_seed_zh_terms_127', 'terms', 'zh', '保证和产品相容性', '保证范围取决于产品页或发票上显示的产品、品牌和提供者。 可适用制造商或经销商的条件。

除非明确确认,相容性信息是指导。 在购买前核实有关的型号、大小、材料、规格或使用要求。', '', NULL, 4, true),
('policy_seed_zh_terms_128', 'terms', 'zh', '软件和数字项目', '软件,活化键,订阅和数字产品由其出版商许可条款管辖. 除非法律要求或经证明存在缺陷,否则已交付或启用的证书不得退回。

您不得转售、复制、绕过许可证管制或在其许可许可范围之外使用数字产品。', '', NULL, 5, true),
('policy_seed_zh_terms_129', 'terms', 'zh', '账目和可接受用途', '准确记录和联系信息,保护您的全权证书。 你对账户活动负责,除非立即报告未经授权的使用。

禁止自动滥用,诈骗,非法使用,干扰服务,虚假主张和企图进入受限制系统.', '', NULL, 6, true),
('policy_seed_zh_terms_130', 'terms', 'zh', '注销、收益和负债', '取消和回归资格遵循订单状态并公布回归政策. 退款时间也取决于付款提供者。

在适用法律允许的范围内,赔偿责任限于与受影响命令有关的直接损失。 在法律上不能排除的权利仍然没有受到影响。', '', NULL, 7, true),
('policy_seed_zh_terms_131', 'terms', 'zh', '政策变化和联系', '我们可以更新这些术语,以反映业务、法律或服务的变化。 生效日期为当前版本。 在命令任何条件不明之前, 联系支持 。

联系支助

读取返回策略', '', NULL, 8, true),
('policy_seed_zh_faq_132', 'faq', 'zh', '我能从这家店买什么?', '我们的可用范围按照存储前栏显示的活线类别排列. 浏览分类或搜索目录以查看当前提供的内容 。', '通告周知', NULL, 0, true),
('policy_seed_zh_faq_133', 'faq', 'zh', '你的产品收藏量有多大?', '我国的产品收集继续增长,并定期以新来者和现有库存更新。', '通告周知', NULL, 1, true),
('policy_seed_zh_faq_134', 'faq', 'zh', '我如何确认产品兼容性?', '比较规格中的模型,界面,尺寸和其他要求. 如果相容性不明, 在命令前先联系支持 。', '通告周知', NULL, 2, true),
('policy_seed_zh_faq_135', 'faq', 'zh', '我该怎么创建账户?', '打开登录或签名, 选择注册, 并创建您的姓名、 电子邮件和密码账户 。', '通告周知', NULL, 3, true),
('policy_seed_zh_faq_136', 'faq', 'zh', '我需要一个账户来下订单吗?', '可能会有来宾预约。 一个账户可以更容易地跟踪订单和使用账户特征.', '订购和付款', NULL, 4, true),
('policy_seed_zh_faq_137', 'faq', 'zh', '你支持哪种支付方法?', '现有的支付方法出现在离职时,可以包括移动支付、卡片和交货现金。', '订购和付款', NULL, 5, true),
('policy_seed_zh_faq_138', 'faq', 'zh', '我可以取消我的订单吗?', '取消取决于订单状态. 打开您的订单细节以检查可用的动作或联系人支持 。', '订购和付款', NULL, 6, true),
('policy_seed_zh_faq_139', 'faq', 'zh', '我的付款安全吗?', '离职用途支持付款提供者和安全处理。 敏感的支付凭证不由商店存储.', '订购和付款', NULL, 7, true),
('policy_seed_zh_faq_140', 'faq', 'zh', '我怎么才能收到订单确认书?', '确认和状态更新可以出现在您的账户中,也可以通过已配置的电子邮件或短消息频道发送.', '订购和付款', NULL, 8, true),
('policy_seed_zh_faq_141', 'faq', 'zh', '送货费多少?', '交货费取决于交货区、运货车和现行货运规则。 最后数额在离职时显示。', '交货和运输', NULL, 9, true),
('policy_seed_zh_faq_142', 'faq', 'zh', '送货要多久?', '估计数取决于库存地点、目的地和信使范围,并在离职或订单处理过程中显示。', '交货和运输', NULL, 10, true),
('policy_seed_zh_faq_143', 'faq', 'zh', '你在哪里送货?', '能否交付取决于有效信使的覆盖范围和在离职时输入的地址。', '交货和运输', NULL, 11, true),
('policy_seed_zh_faq_144', 'faq', 'zh', '我怎么追踪我的订单?', '打开我的命令并选择命令查看其当前状态和可用的货运跟踪 。', '交货和运输', NULL, 12, true),
('policy_seed_zh_faq_145', 'faq', 'zh', '你提供快递吗?', '为选定的地址和顺序提供支持时,可以出现快递或快递。', '交货和运输', NULL, 13, true),
('policy_seed_zh_faq_146', 'faq', 'zh', '我能还个产品吗?', '由于损坏、缺陷或项目不正确等支持原因,合格产品可在适用的窗口内返回。', '回返和退款', NULL, 14, true),
('policy_seed_zh_faq_147', 'faq', 'zh', '退款过程如何运作?', '经批准,退回和检查后,按照批准的办法发给退款. 供应商的处理时间可能不同。', '回返和退款', NULL, 15, true),
('policy_seed_zh_faq_148', 'faq', 'zh', '我能换个产品吗?', '根据收益原因、产品资格和现有库存情况,可以进行交易所交易。', '回返和退款', NULL, 16, true),
('policy_seed_zh_faq_149', 'faq', 'zh', '如果我忘了密码怎么办?', '在登录页面上使用被忽略的密码, 输入您注册的电子邮件并遵循重设指令 。', '账户和概况', NULL, 17, true),
('policy_seed_zh_faq_150', 'faq', 'zh', '我要怎么更新我的档案?', '打开您的账户配置以更新可用的个人和联系人信息。', '账户和概况', NULL, 18, true),
('policy_seed_zh_faq_151', 'faq', 'zh', '我怎么能看清我的订单历史?', '打开我的账户并选择我的订单以查看当前和以前的购买 。', '账户和概况', NULL, 19, true),
('policy_seed_zh_faq_152', 'faq', 'zh', '我如何管理保存地址?', '打开账户中的地址区以添加、编辑或删除保存的发送地址。', '账户和概况', NULL, 20, true),
('policy_seed_zh_faq_153', 'faq', 'zh', '我怎么知道产品是否库存?', '产品页显示其目前可用性. 股票可以更改,直到确定订单。', '产品和可得性', NULL, 21, true),
('policy_seed_zh_faq_154', 'faq', 'zh', '产品价格是否有所变化?', '价格和晋升可能发生变化。 经确认的离职总额是适用于所提交订单的价格。', '产品和可得性', NULL, 22, true),
('policy_seed_zh_faq_155', 'faq', 'zh', '哪里能找到规格?', '打开产品页并审查其描述,属性,变体和规格等部分.', '产品和可得性', NULL, 23, true),
('policy_seed_zh_faq_156', 'faq', 'zh', '我能比较一下产品吗?', '使用可用的类别,过滤器和产品细节来比较选项,或联系支持提供指导意见.', '产品和可得性', NULL, 24, true),
('policy_seed_zh_sitemap_157', 'sitemap', 'zh', '配送政策', '', '', '/ecommerce/shipping', 0, true),
('policy_seed_zh_sitemap_158', 'sitemap', 'zh', '退货政策', '', '', '/ecommerce/returns', 1, true),
('policy_seed_zh_sitemap_159', 'sitemap', 'zh', '隐私政策', '', '', '/ecommerce/privacy', 2, true),
('policy_seed_zh_sitemap_160', 'sitemap', 'zh', '常见问题', '', '', '/ecommerce/faq', 3, true),
('policy_seed_zh_sitemap_161', 'sitemap', 'zh', '服务条款', '', '', '/ecommerce/terms', 4, true),
('policy_seed_ar_shipping_162', 'shipping', 'ar', 'الشحن والتسليم', 'مِنْ تَأكيدِ الطلبِ إلى تسليمِ المدخلِ، يَرى كَمْ رزمتَكَ تَتحرّكُ.', '', NULL, 0, true),
('policy_seed_ar_shipping_163', 'shipping', 'ar', 'الشحن والتسليم', 'تقدير التسليم

عرض أثناء عملية التفتيش

ويتفاوت التوقيت حسب الموقع والمخزون وتغطية حامل الحقيبة.

التغليف المضمون

حزمة من الرعاية

فالبنود مستعدة للحد من خطر الضرر العابر.

دعم التنفيذ

المساعدة عند الحاجة

اتصل بنا إذا وصل التعقب إلى مشكلة', '', NULL, 1, true),
('policy_seed_ar_shipping_164', 'shipping', 'ar', 'كيف تصلك أوامرك', 'تأكيد الأمر

نتحقق من تفاصيل الدفع والمخزون والتوصيل قبل التجهيز

التعبئة والتغليف

يتم فحص المواد الصحيحة وحزمها بأمان

تسليم الركاب

والشحنة مخصصة لشريك التسليم المتاح.

التسليم التدريجي

تتبع التقدم وتفحص الطرد عندما يصل', '', NULL, 2, true),
('policy_seed_ar_shipping_165', 'shipping', 'ar', 'إرشادات تقديم المساعدة', 'ويمكن أن تساعد بعض الشيكات البسيطة على تجنب التأخيرات وجعل التسليم أكثر سلاسة.

توفير عنوان كامل وعلامة بارزة ورقم هاتف قابل للتواصل

:: معالجة مواعيد تقديم الخدمات كتقديرات، لا سيما أثناء العطلات أو الطقس الحاد.

أبقي هاتفك متاحاً عندما يتصل بك الساعي

Use order tracking or contact support if there is no update for an unusual period.

تحقق من الطرد الخارجي والإبلاغ عن الأضرار الظاهرة في أقرب وقت ممكن.

أبقي الفاتورة و التغليف حتى ترضى بالمنتج', '', NULL, 3, true),
('policy_seed_ar_returns_166', 'returns', 'ar', 'العودة والمبالغ المستردة', 'A clear process for reporting eligible product issues and receiving support.', '', NULL, 0, true),
('policy_seed_ar_returns_167', 'returns', 'ar', 'العودة والمبالغ المستردة', 'نافذة العودة

طلب العودة في غضون الفترة المبينة في تفاصيل المنتج أو الطلب.

حالة المنتجات

إحتفظ بالمنتجات والزوايا والفاتورة والتعبئة الأصلية معاً

الاستعراض والقرار

ونحن نفتش الطلب ونؤكد التبادل المناسب أو الاستبدال أو إعادة الأموال.', '', NULL, 1, true),
('policy_seed_ar_returns_168', 'returns', 'ar', 'أسباب العودة المؤهلة', 'لقد حصلت على منتج مختلف أو متغير

والمنتج له عيب في التصنيع والجودة.

ووصل المنتج مضروبا في العبور.

الوصلات المطلوبة أو الأجزاء مفقودة', '', NULL, 2, true),
('policy_seed_ar_returns_169', 'returns', 'ar', 'غير مؤهلة عادة', 'الضرر الناجم بعد التسليم من خلال إساءة الاستخدام أو حادث.

المنتجات التي تم تغييرها أو إصلاحها أو تعديلها دون موافقة.

الطلبات المقدمة بعد نافذة العودة المنطبقة.

وتعاد المنتجات دون التغليف أو الضم أو إثبات الشراء.', '', NULL, 3, true),
('policy_seed_ar_returns_170', 'returns', 'ar', 'كيف تعمل عملية العودة', 'دعم الاتصال

نتشارك رقم طلبك، والقضية، والصور الواضحة أو الفيديو عند الاقتضاء.

الحصول على الموافقة

فريقنا يستعرض الأهلية ويقدم تعليمات العودة

إرسال البند أو تسليمه

واشتملت جميع الأصناف على نحو آمن واتباع طريقة التسليم المعتمدة.

تلقي القرار

بعد التفتيش، نكمل الاستبدال أو التبادل أو الاسترداد', '', NULL, 4, true),
('policy_seed_ar_returns_171', 'returns', 'ar', 'المبالغ المردودة وتفاصيل الصرف', 'وقت التجهيز

عادة ٥-٧ أيام عمل بعد الموافقة والتفتيش.

طريقة استرداد الأموال

وتعاد المبالغ المستردة عموما من خلال طريقة السداد الأصلية.

الشحنات العائدة

وتتوقف المسؤولية على سبب العودة والتعليمات المعتمدة.

توافر الصرف

وتتوقف أسعار الصرف على الاستحقاق الحالي للمخزون والمنتجات.', '', NULL, 5, true),
('policy_seed_ar_privacy_172', 'privacy', 'ar', 'سياسة الخصوصية', 'خصوصيتك مهمة لنا', '', NULL, 0, true),
('policy_seed_ar_privacy_173', 'privacy', 'ar', 'سياسة الخصوصية', 'أمن البيانات

الضمانات المعقولة تستخدم لحماية معلوماتك

الشفافية

ونحن نشرح المعلومات التي يتم جمعها ولماذا هي مطلوبة.

سيطرتك

يمكنك مراجعة وتحديث المعلومات المتاحة عن الحسابات', '', NULL, 1, true),
('policy_seed_ar_privacy_174', 'privacy', 'ar', 'ما نجمعه', 'المعلومات الشخصية

الاسم وعنوان البريد الإلكتروني

رقم الهاتف

عنوان التسليم

المعلومات المطلوبة

أفضليات المنتجات

تاريخ النظام

معلومات عن طريقة الدفع، باستثناء وثائق التفويض الحساسة

معلومات الاستخدام

نشاط الحشد

بنود جدول الأعمال

الآراء

ما لا نخزنه

تفاصيل حساب مصرفي كامل

أرقام البطاقات الكاملة

كلمات السر', '', NULL, 2, true),
('policy_seed_ar_privacy_175', 'privacy', 'ar', 'كيف نستخدم معلوماتك', 'الاستخدامات الأساسية

تجهيز الطلبات وتسليمها

إدارة الحسابات

دعم العملاء

توصيات المنتجات ذات الصلة

بإذنك

تسويق الرسائل الإلكترونية

العروض والترقية الخاصة

إخطارات المنتجات الجديدة

الدراسات الاستقصائية وطلبات التعقيب', '', NULL, 3, true),
('policy_seed_ar_privacy_176', 'privacy', 'ar', 'حقوقك', 'الحصول على معلوماتك

يمكنك طلب الوصول إلى المعلومات التي نحملها عنك

آخر المعلومات

يمكنك تحرير التفاصيل المتاحة أو أن تطلب منا تصحيحها', '', NULL, 4, true),
('policy_seed_ar_terms_177', 'terms', 'ar', 'المصطلحات والشروط', 'وتوضح هذه المصطلحات كيف تعمل الحسابات، وأوامر المنتجات، والمدفوعات، والوفاء، والدعم بعد البيع عندما تستخدم CODEXPLACEHOLDERTKEN.

من خلال الوصول إلى المتجر، إنشاء حساب أو وضع أمر، توافق على هذه الشروط وربط الخصوصية، والشحن وسياسات العودة. إذا كنت لا توافق، لا تقدم أمرا.', '', NULL, 0, true),
('policy_seed_ar_terms_178', 'terms', 'ar', 'الأوامر والتوافر', 'تقديم أمر هو طلب الشراء. ويُقبل أمر ما بعد التحقق من المعلومات المتعلقة بالمخزونات والسعر والدفع والتسليم.

ويمكن أن تتغير المنتجات والمتغيرات ومخزونات المستودعات قبل تأكيدها. إذا أصبح البند غير متاح، يمكننا أن نقدم بديلاً، وننقح الأمر بموافقتك أو نلغيه، ونرد المبلغ المتضرر.', '', NULL, 1, true),
('policy_seed_ar_terms_179', 'terms', 'ar', 'الخصخصة والدفع', 'وتظهر الأسعار بالعملة المُعرضة ويمكن أن تتغير دون إشعار. ويشمل المجموع المؤكد الخصومات والضرائب ورسوم الإيصال المطبقة التي تظهر أثناء عملية المغادرة.

وتخضع أساليب الدفع لموافقة مقدمي الخدمات. وتظل المعلومات المتعلقة بالنفقة، حيثما تبين، إرشادية إلى أن يؤكد مقدم الخدمات الأهلية والرسوم والحيازة.', '', NULL, 2, true),
('policy_seed_ar_terms_180', 'terms', 'ar', 'التسليم والتفتيش', 'وتقديرات التسليم ليست ضمانات ويمكن أن تتأثر بموقع المخزون، وتغطية حاملي الحقيبة، والطقس، والعطلات، والأحداث التي تقع خارج نطاق سيطرتنا المعقولة.

فحص الطرد والمنتج بسرعة. Report missing, damaged or incorrect items through support within the period stated in the return policy.', '', NULL, 3, true),
('policy_seed_ar_terms_181', 'terms', 'ar', 'الضمان وتوافق المنتجات', 'وتتوقف تغطية التحذيرات على المنتج والعلامة التجارية والمقدم على صفحة المنتج أو الفواتير. ويجوز تطبيق شروط المصانع أو الموزعة.

والمعلومات المتعلقة بالقابلية للمقارنة هي إرشادات ما لم يتم تأكيدها صراحة. التحقق من متطلبات النموذج أو الحجم أو المواد أو المواصفات أو الاستخدام ذات الصلة قبل الشراء.', '', NULL, 4, true),
('policy_seed_ar_terms_182', 'terms', 'ar', 'البرمجيات والمواد الرقمية', 'وتخضع مفاتيح البرمجيات والتنشيط والاشتراكات والمنتجات الرقمية لشروط ترخيص ناشريها. ولا يجوز إعادة وثائق التفويض المسلَّمة أو المفعَّلة إلا إذا كان ذلك ضرورياً قانوناً أو كان معيباً.

لا يجب أن تُعيد بيعها أو تُنسخها أو تُستخدم مُنتجاً رقمياً خارج رخصتها المسموح بها', '', NULL, 5, true),
('policy_seed_ar_terms_183', 'terms', 'ar', 'الحسابات والاستخدام المقبول', 'حافظي على معلومات الحساب والاتصال بدقة و حماية وثائق تفويضك أنت مسؤول عن نشاط الحساب ما لم يتم الإبلاغ فورا عن استخدام غير مأذون به.

ويحظر الإساءة أو الاحتيال أو الاستخدام غير المشروع أو التدخل في الخدمة أو الادعاءات الكاذبة أو محاولات الوصول إلى نظم مقيدة.', '', NULL, 6, true),
('policy_seed_ar_terms_184', 'terms', 'ar', 'الإلغاءات والعائدات والمسؤولية', 'ويتبع إلغاء الأهلية واستحقاق العودة حالة النظام وينشر سياسة العودة. ويمكن أيضا أن يعتمد توقيت استرداد الأموال على مقدِّم المدفوعات.

وتقتصر المسؤولية، بالقدر الذي يسمح به القانون المنطبق، على الخسارة المباشرة المرتبطة بالنظام المتأثر. ولا تزال الحقوق التي لا يمكن استبعادها قانوناً غير متأثرة.', '', NULL, 7, true),
('policy_seed_ar_terms_185', 'terms', 'ar', 'التغييرات في السياسات والاتصال', 'ويمكننا أن نستكمل هذه المصطلحات بحيث تعكس التغييرات التشغيلية أو القانونية أو التغييرات في الخدمات. ويحدد التاريخ الفعلي الصيغة الحالية. الاتصال بالدعم قبل طلب أي حالة غير واضحة.

دعم الاتصال

سياسة العودة إلى القراءة', '', NULL, 8, true),
('policy_seed_ar_faq_186', 'faq', 'ar', 'ما الذي يمكنني شراؤه من هذا المتجر؟', 'وينظم نطاقنا المتاح الفئات الحية المبينة في المخزن. فئات الحشد أو البحث في المفهرس لمعرفة ما هو مقدم حاليا.', 'معلومات عامة', NULL, 0, true),
('policy_seed_ar_faq_187', 'faq', 'ar', 'كم حجم منتجاتك؟', 'وما زال جمع منتجاتنا ينمو ويستكمل بانتظام مع الوافدين الجدد والمخزون الحالي.', 'معلومات عامة', NULL, 1, true),
('policy_seed_ar_faq_188', 'faq', 'ar', 'كيف أتأكد من توافق المنتج؟', 'Compare the model, interface, dimensions and other requirements in the specifications. الاتصال بالدعم قبل طلب ما إذا كان التوافق غير واضح.', 'معلومات عامة', NULL, 2, true),
('policy_seed_ar_faq_189', 'faq', 'ar', 'كيف أصنع حساباً؟', 'افتحي اللوم أو وقعي، اختاري السجل، وخلقي حساباً بإسمك، والبريد الإلكتروني وكلمة السر.', 'معلومات عامة', NULL, 3, true),
('policy_seed_ar_faq_190', 'faq', 'ar', 'هل أحتاج حساباً لوضع أمر؟', 'قد يكون التفقد متاحاً فالحساب يجعل من الأسهل تتبع الأوامر واستخدام خصائص الحسابات.', 'الأمر والمدفوعات', NULL, 4, true),
('policy_seed_ar_faq_191', 'faq', 'ar', 'أي طرق الدفع التي تدعمها؟', 'وتظهر أساليب الدفع المتاحة أثناء عملية التفتيش ويمكن أن تشمل المدفوعات المتنقلة والبطاقات والنقد عند التسليم.', 'الأمر والمدفوعات', NULL, 5, true),
('policy_seed_ar_faq_192', 'faq', 'ar', 'هل يمكنني إلغاء طلبي؟', 'الإلغاء يعتمد على حالة النظام افتحي تفاصيل طلبكِ لتفقد العمل المتاح أو دعم الاتصال', 'الأمر والمدفوعات', NULL, 6, true),
('policy_seed_ar_faq_193', 'faq', 'ar', 'هل دفعتي آمنة؟', 'وتدعم استخدامات التفتيش مقدمي المدفوعات والمناولة الآمنة. ولا يخزن المخزن وثائق تفويض الدفع الحساسة.', 'الأمر والمدفوعات', NULL, 7, true),
('policy_seed_ar_faq_194', 'faq', 'ar', 'كيف سأتلقى تأكيد الطلب؟', 'ويمكن أن تظهر المعلومات المستكملة عن الحالة في حسابكم، كما يمكن إرسالها من خلال قنوات البريد الإلكتروني الموحّدة أو SMS.', 'الأمر والمدفوعات', NULL, 8, true),
('policy_seed_ar_faq_195', 'faq', 'ar', 'كم ثمن الشحنة؟', 'وتتوقف رسوم التسليم على منطقة التسليم والعربات وقواعد الشحن الحالية. ويظهر المبلغ النهائي عند المغادرة.', 'التسليم والشحن', NULL, 9, true),
('policy_seed_ar_faq_196', 'faq', 'ar', 'كم يستغرق التسليم؟', 'ويتوقف هذا التقدير على تحديد موقع الجرد، والمقصد، وتغطية حاملي البريد، ويظهر أثناء عملية التفتيش أو تجهيز الطلبات.', 'التسليم والشحن', NULL, 10, true),
('policy_seed_ar_faq_197', 'faq', 'ar', 'أين تُسلّمُ؟', 'ويتوقف توافر التوصيل على التغطية النشطة لحاملي البريد والعنوان الذي أُدخل أثناء عملية التفتيش.', 'التسليم والشحن', NULL, 11, true),
('policy_seed_ar_faq_198', 'faq', 'ar', 'كيف يمكنني تتبع طلبي؟', 'افتحوا أوامري واختاروا الأمر لرؤية حالتها الحالية وتتبع الشحنات المتاحة', 'التسليم والشحن', NULL, 12, true),
('policy_seed_ar_faq_199', 'faq', 'ar', 'هَلْ تَعْرضُ الإيصال السريع؟', 'ويمكن أن يظهر الإيصال السريع أو السريع عند دعمه للعنوان والنظام المختارين.', 'التسليم والشحن', NULL, 13, true),
('policy_seed_ar_faq_200', 'faq', 'ar', 'هل يمكنني إعادة منتج؟', 'ويمكن إعادة المنتجات المؤهلة داخل النافذة المنطبقة لأسباب مدعومة مثل الضرر أو العيوب أو بند غير صحيح.', 'العودة والمبالغ المستردة', NULL, 14, true),
('policy_seed_ar_faq_201', 'faq', 'ar', 'كيف تعمل عملية استرداد الأموال؟', 'وبعد الموافقة والعودة والتفتيش، يصدر المبلغ المسترد عن طريق الطريقة المعتمدة. وقد تتفاوت أوقات تجهيز المورد.', 'العودة والمبالغ المستردة', NULL, 15, true),
('policy_seed_ar_faq_202', 'faq', 'ar', 'هل يمكنني تبادل المنتج؟', 'وقد يكون التبادل متاحاً حسب سبب العودة، وأهلية المنتجات، والمخزون الحالي.', 'العودة والمبالغ المستردة', NULL, 16, true),
('policy_seed_ar_faq_203', 'faq', 'ar', 'ماذا يجب أن أفعل لو نسيت كلمة السر؟', 'استخدمي كلمة السر في صفحة الدخول و أدخلي بريدك الإلكتروني المسجل و اتبعي التعليمات', 'الحساب والموجز', NULL, 17, true),
('policy_seed_ar_faq_204', 'faq', 'ar', 'كيف أقوم بتحديث ملفي؟', 'افتح ملف حسابك لتحديث المعلومات الشخصية والمتصلة', 'الحساب والموجز', NULL, 18, true),
('policy_seed_ar_faq_205', 'faq', 'ar', 'كيف لي أن أرى تاريخ طلبي؟', 'افتح حسابي واختار أوامري لأرى المشتريات الحالية والسابقة', 'الحساب والموجز', NULL, 19, true),
('policy_seed_ar_faq_206', 'faq', 'ar', 'كيف أدير عناوين منقذة؟', 'افتحي قسم العنوان في حسابك لإضافة عناوين التسليم المنقذة أو تحريرها أو إزالتها', 'الحساب والموجز', NULL, 20, true),
('policy_seed_ar_faq_207', 'faq', 'ar', 'كيف لي أن أعرف ما إذا كان المنتج في المخزون؟', 'وتبين صفحة المنتج توافرها الحالي. يمكن للمخزون أن يتغير حتى يتم تأكيد أمر', 'المنتجات والتوافر', NULL, 21, true),
('policy_seed_ar_faq_208', 'faq', 'ar', 'هل تغيرت أسعار المنتجات؟', 'وقد تتغير الأسعار والترقية. ومجموع التحقق المؤكد هو السعر الذي ينطبق على النظام المقدم.', 'المنتجات والتوافر', NULL, 22, true),
('policy_seed_ar_faq_209', 'faq', 'ar', 'أين أجد المواصفات؟', 'فتح صفحة المنتج واستعراض وصفه وخصائصه ومتغيراته وأقسام المواصفات.', 'المنتجات والتوافر', NULL, 23, true),
('policy_seed_ar_faq_210', 'faq', 'ar', 'هل يمكنني مقارنة المنتجات؟', 'Use available categories, filters and product details to comparison options, or contact support for guidance.', 'المنتجات والتوافر', NULL, 24, true),
('policy_seed_ar_sitemap_211', 'sitemap', 'ar', 'سياسة الشحن', '', '', '/ecommerce/shipping', 0, true),
('policy_seed_ar_sitemap_212', 'sitemap', 'ar', 'سياسة الإرجاع', '', '', '/ecommerce/returns', 1, true),
('policy_seed_ar_sitemap_213', 'sitemap', 'ar', 'سياسة الخصوصية', '', '', '/ecommerce/privacy', 2, true),
('policy_seed_ar_sitemap_214', 'sitemap', 'ar', 'الأسئلة الشائعة', '', '', '/ecommerce/faq', 3, true),
('policy_seed_ar_sitemap_215', 'sitemap', 'ar', 'شروط الخدمة', '', '', '/ecommerce/terms', 4, true),
('policy_seed_ne_shipping_216', 'shipping', 'ne', 'Transport and livrance', 'From order confirmation to porte livrance, see how your package move.', '', NULL, 0, true),
('policy_seed_ne_shipping_217', 'shipping', 'ne', 'Transport and livrance', 'Livras estimations

View in checkout

Timing variabel per location, inventar and currier coverture.

♫ Secure package

ʹPacked with careful

≤ elemente сте prepared to reduce the risk of danse in transit.

± support fornesta

■ help, quando necessariu

Contact us si track stalls of the package arrive with un question.', '', NULL, 1, true),
('policy_seed_ne_shipping_218', 'shipping', 'ne', '♫ How your order arrive you', 'Confirmation of Order

♫ We verified paging, stock and livrance details before processing.

ʹ Picking and package

♫ The correct items is controled and packed security.

Courier handover

❖ Transportion asignified to a disponible partner of livrage.

♫portstep levering

■ track progress and inspektion the package quando arrivé.', '', NULL, 2, true),
('policy_seed_ne_shipping_219', 'shipping', 'ne', '♫ Helpful levering guidness', 'Uneles checks, democrating, democrating, democrating, democrating, democrating, democrating, democrating, democrating, democrating, democrating, democrating, democrating, democrating, democrating, democrating, democrating, democrating, democrating.

≤ disponible a komplete adresse, original mensage and possible telefon number.

♫ Trata datum de livrai como estimations, specialmente durante festivals ou tempo grave.

■ Garden your telefon disponible when the currier contact you.

■ Use order tracking or contact support si no update for unbian period.

■ Kontrole extern package and rapport visible dammage tools possible.

manteni factorial and package timeo timeo timeout of the product.', '', NULL, 3, true),
('policy_seed_ne_returns_220', 'returns', 'ne', '♫ Returns and restitutions', '■ Klar process for rapporting themies of product qualified and receive subsidies.', '', NULL, 0, true),
('policy_seed_ne_returns_221', 'returns', 'ne', '♫ Returns and restitutions', '♫ Return Windows

± request a return in the period showd on the product or order details.

Product condition

manteni apartament produkt, accessoires, factura and original package.

• Review and resolution

́ ́a inspektivue ́n request and confirm the appropriate cange, substitution of restitution.', '', NULL, 1, true),
('policy_seed_ne_returns_222', 'returns', 'ne', 'ë eliġible return rasons', '你 recebite un diverse product or variant.

===============================================================================================================================================================================================================================================================

*At produkt tienge damuit in transit.

mancant accessoires of parts necessary.', '', NULL, 2, true),
('policy_seed_ne_returns_223', 'returns', 'ne', '♫ Normally non eliminable', '≤ dama provocate post livration, per usouse or accident.

Products que exists modified, reparation or modified with your approbation.

± requests presentats post applicable return window.

■ produktions returnés san emballage, accessoires ou prova de aquisition.', '', NULL, 3, true),
('policy_seed_ne_returns_224', 'returns', 'ne', '♫ How function the return process', 'Contact support

Share your order number, the email and clear fotos or video quando relevant.

♫ Recipe approbation

Our team reviews elegibility and for the return instructions.

Send or have over the item

± pakkete alles included items security and follow the approved handover method.

♫ reception the resolution

± post inspektion, kompletemos approved remplacement, scambio ou restitution.', '', NULL, 4, true),
('policy_seed_ne_returns_225', 'returns', 'ne', '• Refunder and swake details', 'Processerings time

===============================================================================================================================================================================================================================================================

■ Refunder method

• Refusions generalmente returneres per l''original metodo de pagamento.

ë return transport

Responsabilidad depende od return rason and the approved instructions.

Exchange

Exchanges depende o aktual stock and product admissibility.', '', NULL, 5, true),
('policy_seed_ne_privacy_226', 'privacy', 'ne', 'Politika privacy', 'ʹNotre privacy is important for us.', '', NULL, 0, true),
('policy_seed_ne_privacy_227', 'privacy', 'ne', 'Politika privacy', 'Data security

■ rezonable garanties usas pou protegerwe information.

Transparency

我们 explique que information collected and why it is need.

♫ your control

♫ You can review and update displayed account information.', '', NULL, 1, true),
('policy_seed_ne_privacy_228', 'privacy', 'ne', '♫ what we collected', 'ë/a ́n ́n ́a ́n ́a ́n ́a ́n ́a ́n ́a ́n ́a ́n ́a ́n ́a ́n ́a ́n ́ information ́a ́n ́a ́n ́a ́a ́n ́a ́n ́a ́n ́a ́a ́n ́a ́n ́a ́a ́n ́a ́a ́n information ́a ́a ́n ́a ́a ́ ́a ́n ́a ́a ́ ́ ́ ́a ́ ́ ́a ́ ́a ́ ́a ́ ́ ́ ́ ́ ́ ́ ́ ́ ́ ́ ́ ́ ́ ́ ́ ́ ́ ́ ́ ́ ́ ́ ́ ́ ́ ́ ́ ́ ́ ́ ́

ʹ name and email address

■ Telefonnumber

Adres destinatario

Información opinion

Product preferencies

History history of ring order

Información metodo de pagamento, exclusive sensitive credentials

Información o Use-Use-Information

♫ browsing activity

♫ List items

® Page Views

♫ whateer need store

Details de full bank account

§Full card numbers

ʹPasswords Plain-text', '', NULL, 2, true),
('policy_seed_ne_privacy_229', 'privacy', 'ne', '• How us your information', '♫ Essential Uses

Process and levering for order

Account management

Support support clients

± relevante recomendationes de produkt

ʹBive your permission

Jean Marketing emails

Speciale offers and promotions

Notifications of New product

Survees and feedback requests', '', NULL, 3, true),
('policy_seed_ne_privacy_230', 'privacy', 'ne', '§Your droits', 'Access your information

♫ You can request access to the information of you.

Information of Update

♫ You can editing disponible profil details of profile or sound us to corriged thes.', '', NULL, 4, true),
('policy_seed_ne_terms_231', 'terms', 'ne', 'Terminals and conditions', 'Disse termines expliquen how accounts, product orders, pagations, realisation and after-sales support work when you usage this store.

===============================================================================================================================================================================================================================', '', NULL, 0, true),
('policy_seed_ne_terms_232', 'terms', 'ne', '♫ Orders and disponibility', '♫ Transmitting un order is a request for acquist. Un order is accepted post stock, price, paging and livrage information exist verified.

Products, variantes and magazine stocks can can change anto confirmation. Si un item do not displayed, we can offre un alternative, revision the order with your homologation or cancel and restitute the affect month.', '', NULL, 1, true),
('policy_seed_ne_terms_233', 'terms', 'ne', '• Pricing and page', 'Limited total includ accessable discounts, taxs and livraus charges showed durante checkout.

Limiteds formulators reserves, defineres, defineres, de reception, de reception, de reception, de reserves, de reception, de reception, de reception, de responsability, de courses, de reserves, de reception, de responsibility, de courses, de reserves.', '', NULL, 2, true),
('policy_seed_ne_terms_234', 'terms', 'ne', 'Livration and inspektion', 'Lietude de distributions estimations non sunt garanties, events of the house locale, coverture, category, festivals or events exteriors of our raisonable control.

• Inspektez prompt package and product. Report manked, damoused or incorrect items per sosteni intitulé download the period declared in the return politic.', '', NULL, 3, true),
('policy_seed_ne_terms_235', 'terms', 'ne', 'ʹGranty and product compatibility', 'Product coverture depende on the product, marke and provider disponible on the product page of factory. Producent or distributor conditions can application.

• information de compatibilitate is direction, exceptionally confirmed. Verifiquere relevant model, size, material, specifikation of usage requisitions anteriormente initial acquist.', '', NULL, 4, true),
('policy_seed_ne_terms_236', 'terms', 'ne', '♫ software and digital items', 'Software, keys de activation, abonnements and digital products reglementeres by their publicer license terms. Livrated or activate kredencials most neverable returnable, excepte where legally required or proved defect.

Us necessita resell, copy, bypass controls de licenciation or use un product digital extern of the permiss license.', '', NULL, 5, true),
('policy_seed_ne_terms_237', 'terms', 'ne', 'Accounts and acceptable utilisation', '* Guarde account and contact information exacte and protect your credentials. You are responsable for activity of account, exceptionly not reported un autorized usage.

■ Automatiserings abuso, fraude, ilegal uso, interference en service, false pretensions and essaings for access to systems restrictions são prohibits.', '', NULL, 6, true),
('policy_seed_ne_terms_238', 'terms', 'ne', '• Cancellations, returns and responsability', '• Cancellation and return kalibity follow the stand for order and publiced return politic. Refunder time time can depend on the provider of page.

Total aspekt, total aspekt, aspekt, aspekt, aspekt, aspekt, aspekt, aspekt, aspekt, aspekt, aspekt, aspekt;', '', NULL, 7, true),
('policy_seed_ne_terms_239', 'terms', 'ne', 'Cambios policy and contact', '♫ We can update this terms for reflecting operational, legal or service changes. The effect date identific the current version. Contact support before ordring si a condition non clear.

Contact support

Read return policy', '', NULL, 8, true),
('policy_seed_ne_faq_240', 'faq', 'ne', '¿Qué couch me aquire d''home?', 'Dialog Our disponible range is organised by the live categorys showd in the storefront. Browser kategories or search the catalog for see what is offred actually.', 'Información generala', NULL, 0, true),
('policy_seed_ne_faq_241', 'faq', 'ne', '♫ Quanto long is your product collection?', '■ Nossa collection de products continua a cresce, imposible actualizado regularmente med nove arrivée e inventario de nuevo.', 'Información generala', NULL, 1, true),
('policy_seed_ne_faq_242', 'faq', 'ne', '¿Check Spelling?', 'compare model, interface, dimensions and other requirements in the specifications. Contact support before ordring si compatibility is clear.', 'Información generala', NULL, 2, true),
('policy_seed_ne_faq_243', 'faq', 'ne', '♫ How do I create un account?', 'Dialog Open Logging or Registre up, selection Register, and create account with your name, email and password.', 'Información generala', NULL, 3, true),
('policy_seed_ne_faq_244', 'faq', 'ne', '♫ I need un account for command?', 'Like checkout de guests ́s possible exist. Un account fere facilier track orders and use account functions.', 'Ordering and pageses', NULL, 4, true),
('policy_seed_ne_faq_245', 'faq', 'ne', '¿Qué metodes de pagamento de playments you support?', '■ disponible metodes de pagamento apparues durante checkout, eventual mobil payments, cards and cash on livration.', 'Ordering and pageses', NULL, 5, true),
('policy_seed_ne_faq_246', 'faq', 'ne', '■ ¿Putem anulerar mo ordre?', '• Cancellation depend on the order status. Open your order details for control the disponible action or contact support.', 'Ordering and pageses', NULL, 6, true),
('policy_seed_ne_faq_247', 'faq', 'ne', '¿Min page security?', 'Checkout usa supported page providers and secure manipulation. Sensitive page kredencials non conserved by the store.', 'Ordering and pageses', NULL, 7, true),
('policy_seed_ne_faq_248', 'faq', 'ne', '¿Cuál do recepcionar confirmation of order?', '♫ Confirmation and status updates can appeared in your account and the mail canals configurated or SMS canals.', 'Ordering and pageses', NULL, 8, true),
('policy_seed_ne_faq_249', 'faq', 'ne', '♫ quanto livrations charge?', 'Livrage charge depende on the livrage area, cart and actual transport regles.', 'Livraison and transporting', NULL, 9, true),
('policy_seed_ne_faq_250', 'faq', 'ne', '♫ Quanto tempo livration target?', 'L''estimation depende depende de location inventaire, destination coverture and currier, et demonstrated when checkout or order processing.', 'Livraison and transporting', NULL, 10, true),
('policy_seed_ne_faq_251', 'faq', 'ne', '♫ Where you livre?', 'Disponibility of disponibility depend on the active currier coverture and the adresse inputed durante checkout.', 'Livraison and transporting', NULL, 11, true),
('policy_seed_ne_faq_252', 'faq', 'ne', '¿Chwilo me putot seguir mine ordre?', '■ Open My Orders and select the order for see the current status and displayed transmission tracking.', 'Livraison and transporting', NULL, 12, true),
('policy_seed_ne_faq_253', 'faq', 'ne', '¿Offerta express livration?', 'Express or rapide livration remotely appeared when subtened for the selectioned adresse and order.', 'Livraison and transporting', NULL, 13, true),
('policy_seed_ne_faq_254', 'faq', 'ne', '■ ¿Chap i returnerar un product?', '■ produktions eligibless returnering in the finster applicable, por rasons som supported, como damo, defekte ou un element incorrect.', '♫ Returns and restitutions', NULL, 14, true),
('policy_seed_ne_faq_255', 'faq', 'ne', '¿Cuál restitution process funkciona?', 'Processeringstimes for providers more variables.', '♫ Returns and restitutions', NULL, 15, true),
('policy_seed_ne_faq_256', 'faq', 'ne', '■ I can witch un product?', '■ dependente de return rason, de return responsibility of products and current stock.', '♫ Returns and restitutions', NULL, 16, true),
('policy_seed_ne_faq_257', 'faq', 'ne', '¿Qué ibba i face si forget miy password?', '■ Use Forgored Password on the login page, enter your email registred and follow the reset instructions.', 'Account and profile', NULL, 17, true),
('policy_seed_ne_faq_258', 'faq', 'ne', '♫ How do I update my profil?', 'Open your account profile for update the displayed personal and contact information.', 'Account and profile', NULL, 18, true),
('policy_seed_ne_faq_259', 'faq', 'ne', '¿Chómo ilustration de la historia de l''ordre?', '■ Open My Account and select My Orders for view current and previous accounts.', 'Account and profile', NULL, 19, true),
('policy_seed_ne_faq_260', 'faq', 'ne', '♫ How do me management saveed adresses?', 'Open the address section in your account for add, edit or remove saveed livrary adresses.', 'Account and profile', NULL, 20, true),
('policy_seed_ne_faq_261', 'faq', 'ne', '♫ How you know ot un product is in stock?', '♫ The product page month your actual displaying. Stock can change timeout you confirmed un order.', 'Products and disponibility', NULL, 21, true),
('policy_seed_ne_faq_262', 'faq', 'ne', '♫ Produkt prices cambia?', 'Promotions total confirmat checkout total is the price que applicable on the transmeted order.', 'Products and disponibility', NULL, 22, true),
('policy_seed_ne_faq_263', 'faq', 'ne', '¿Where putem trovar specifikationes?', 'Dialog Open the product page and review the description, attributs, variantes and specification sections.', 'Products and disponibility', NULL, 23, true),
('policy_seed_ne_faq_264', 'faq', 'ne', '■ ¿Putem comparadere produkte?', '■ Use disponible kategories, filtros and product details to comparation options, or contact support for guiding.', 'Products and disponibility', NULL, 24, true),
('policy_seed_ne_sitemap_265', 'sitemap', 'ne', 'ढुवानी नीति', '', '', '/ecommerce/shipping', 0, true),
('policy_seed_ne_sitemap_266', 'sitemap', 'ne', 'फिर्ता नीति', '', '', '/ecommerce/returns', 1, true),
('policy_seed_ne_sitemap_267', 'sitemap', 'ne', 'गोपनीयता नीति', '', '', '/ecommerce/privacy', 2, true),
('policy_seed_ne_sitemap_268', 'sitemap', 'ne', 'बारम्बार सोधिने प्रश्न', '', '', '/ecommerce/faq', 3, true),
('policy_seed_ne_sitemap_269', 'sitemap', 'ne', 'सेवाका सर्तहरू', '', '', '/ecommerce/terms', 4, true),
('policy_seed_id_shipping_270', 'shipping', 'id', 'Pengiriman dan pengiriman', 'Dari perintah konfirmasi ke gerbang pengiriman, melihat bagaimana paket Anda bergerak.', '', NULL, 0, true),
('policy_seed_id_shipping_271', 'shipping', 'id', 'Pengiriman dan pengiriman', 'Perkiraan pengiriman

Shown selama checkout

Waktu bervariasi oleh lokasi, inventaris dan cakupan kurir.

Paket aman

Dikemas dengan hati-hati

Item siap untuk mengurangi risiko kerusakan dalam transit.

Dukungan pengiriman

Bantuan ketika dibutuhkan

Hubungi kami jika pelacakan stalls atau paket tiba dengan masalah.', '', NULL, 1, true),
('policy_seed_id_shipping_272', 'shipping', 'id', 'Bagaimana pesanan Anda mencapai Anda', 'Konfirmasi perintah

Kami memverifikasi pembayaran, saham dan rincian pengiriman sebelum memproses.

Memilih dan berkemas

Barang yang benar diperiksa dan dikemas dengan aman.

Kurir menyerahkan

Pengiriman ditugaskan untuk pasangan pengiriman yang tersedia.

Pengiriman pintu

Track kemajuan dan memeriksa paket ketika tiba.', '', NULL, 2, true),
('policy_seed_id_shipping_273', 'shipping', 'id', 'Panduan pengiriman yang banyak', 'Beberapa pemeriksaan sederhana dapat membantu menghindari penundaan dan membuat pengiriman halus.

Menyediakan alamat lengkap, landmark dan nomor telepon dapat dihubungi.

Memperlakukan tanggal pengiriman sebagai perkiraan, terutama selama liburan atau cuaca buruk.

Jauhkan ponsel Anda ketika kurir menghubungi Anda.

Gunakan perintah pelacakan atau dukungan kontak jika tidak ada pemutakhiran untuk periode yang tidak biasa.

Periksa paket luar dan laporkan kerusakan terlihat secepat mungkin.

Jauhkan faktur dan kemasan sampai Anda puas dengan produk.', '', NULL, 3, true),
('policy_seed_id_returns_274', 'returns', 'id', 'Kembali dan pengembalian dana', 'Proses yang jelas untuk melaporkan isu produk yang memenuhi syarat dan menerima dukungan.', '', NULL, 0, true),
('policy_seed_id_returns_275', 'returns', 'id', 'Kembali dan pengembalian dana', 'Kembali jendela

Meminta pengembalian dalam periode yang ditampilkan pada rincian produk atau perintah.

Kondisi produksi

Menjaga produk, aksesoris, faktur dan kemasan asli bersama.

Ulasan dan resolusi

Kami memeriksa permintaan dan mengkonfirmasi pertukaran yang sesuai, pengganti atau pengembalian uang.', '', NULL, 1, true),
('policy_seed_id_returns_276', 'returns', 'id', 'Alasan pengembalian yang bisa dipahami', 'Anda menerima produk yang berbeda atau varian.

Produk ini telah diverifikasi manufaktur atau cacat kualitas.

Produknya rusak saat dalam perjalanan.

Aksesoris yang diperlukan atau suku cadang yang hilang.', '', NULL, 2, true),
('policy_seed_id_returns_277', 'returns', 'id', 'Biasanya tidak memenuhi syarat', 'Kerusakan akibat pengiriman melalui penyalahgunaan atau kecelakaan.

Produk yang telah diubah, diperbaiki atau diubah tanpa persetujuan.

Permintaan diajukan setelah jendela kembali yang dapat diterapkan.

Produk dikembalikan tanpa perlu kemasan, aksesoris atau bukti pembelian.', '', NULL, 3, true),
('policy_seed_id_returns_278', 'returns', 'id', 'Bagaimana proses pengembalian bekerja', 'Dukungan kontak

Berbagi nomor pesanan Anda, masalah dan foto jelas atau video ketika relevan.

Dapatkan persetujuan

Tim kami ulasan eligibilitas dan menyediakan instruksi kembali.

Kirim atau serahkan item

Kemasi semua barang yang disertakan dengan aman dan ikuti metode penyerahan yang disetujui.

Menerima resolusi

Setelah pemeriksaan, kami menyelesaikan pengganti yang disetujui, pertukaran atau pengembalian uang.', '', NULL, 4, true),
('policy_seed_id_returns_279', 'returns', 'id', 'Kembalikan dan tukar rincian', 'Waktu pemrosesan

Biasanya 5-7 hari bisnis setelah persetujuan dan pemeriksaan.

Metode pengembalian dana

Uang secara umum dikembalikan melalui metode pembayaran asli.

Kembali pengiriman

Tanggung jawab tergantung pada alasan pengembalian dan instruksi yang disetujui.

Ketersediaan pertukaran

Perubahan tergantung pada saham dan produk saat ini.', '', NULL, 5, true),
('policy_seed_id_privacy_280', 'privacy', 'id', 'Kebijakan privasi', 'Primamu penting bagi kami.', '', NULL, 0, true),
('policy_seed_id_privacy_281', 'privacy', 'id', 'Kebijakan privasi', 'Keamanan data

Pengaman reasonable digunakan untuk melindungi informasi Anda.

Transparansi

Kami menjelaskan informasi apa yang dikumpulkan dan mengapa diperlukan.

Kontrol Anda

Anda dapat mengulas dan memperbarui informasi akun yang tersedia.', '', NULL, 1, true),
('policy_seed_id_privacy_282', 'privacy', 'id', 'Apa yang kita kumpulkan', 'Informasi pribadi

Nama dan alamat email

Nomor telepon

Alamat pengiriman

Pesan informasi

Pengaturan produk

Pesan sejarah

Informasi metode pembayaran, tidak termasuk kredensial sensitif

Informasi penggunaan

Aktivitas peramban

Butir daftar harapan

Tampilan halaman

Apa yang tidak kita simpan

Rincian rekening bank penuh

Jumlah kartu penuh

Sandi teks-biasa', '', NULL, 2, true),
('policy_seed_id_privacy_283', 'privacy', 'id', 'Bagaimana kami menggunakan informasimu', 'Urat

Pesan pemrosesan dan pengiriman

Manajemen akun

Dukungan pelanggan

Rekomendasi produk Relevan

Dengan izin Anda

Memasaran email

Penawaran khusus dan promosi

Pemberitahuan produk baru

Permintaan pemeriksaan dan umpan balik', '', NULL, 3, true),
('policy_seed_id_privacy_284', 'privacy', 'id', 'Hak Anda', 'Akses informasi Anda

Anda dapat meminta akses ke informasi yang kami miliki tentang Anda.

Mutakhirkan informasi

Anda dapat mengedit rincian profil yang tersedia atau meminta kami untuk memperbaikinya.', '', NULL, 4, true),
('policy_seed_id_terms_285', 'terms', 'id', 'Syarat dan kondisi', 'Istilah ini menjelaskan bagaimana akun, perintah produk, pembayaran, pemenuhan dan setelah dukungan penjualan bekerja ketika Anda menggunakan CODEXPlaceHoLDER0TOKEN.

Dengan mengakses toko, membuat akun atau menempatkan perintah, Anda setuju dengan istilah-istilah ini dan privasi terkait, pengiriman dan kembali kebijakan. Jika kau tidak setuju, jangan tunduk pada perintah.', '', NULL, 0, true),
('policy_seed_id_terms_286', 'terms', 'id', 'Perintah dan ketersediaan', 'Mengirimkan perintah adalah permintaan untuk membeli. Perintah diterima setelah saham, harga, pembayaran dan informasi pengiriman telah diverifikasi.

Produk, varian dan gudang saham dapat berubah sebelum konfirmasi. Jika item menjadi tidak tersedia, kita dapat menawarkan alternatif, merevisi urutan dengan persetujuan Anda atau membatalkan dan mengembalikan jumlah yang terpengaruh.', '', NULL, 1, true),
('policy_seed_id_terms_287', 'terms', 'id', 'Harga dan pembayaran', 'Harga yang ditampilkan dalam mata uang yang ditampilkan dan mungkin berubah tanpa pemberitahuan. Totalnya termasuk diskon yang bisa diterapkan, pajak dan biaya pengiriman yang ditunjukkan selama pemeriksaan.

Metode pembayaran tunduk pada persetujuan penyedia. Informasi instalasi, di mana ditampilkan, tetap menunjukkan, sampai penyedia mengkonfirmasi eligibilitas, biaya dan tenure.', '', NULL, 2, true),
('policy_seed_id_terms_288', 'terms', 'id', 'Pengiriman dan inspeksi', 'Perkiraan pengiriman tidak menjamin dan mungkin terpengaruh oleh lokasi saham, liputan kurir, cuaca, liburan atau peristiwa di luar kendali kita.

Periksa paket dan produknya segera. Laporan hilang, rusak atau salah item melalui dukungan dalam periode dinyatakan dalam kebijakan kembali.', '', NULL, 3, true),
('policy_seed_id_terms_289', 'terms', 'id', 'Kompabilitas Warranty dan produk', 'cakupan Warranty tergantung pada produk, merek dan penyedia yang ditunjukkan pada halaman produk atau faktur. Manufaktur atau kondisi distributor mungkin berlaku.

Informasi kompatibilitas adalah bimbingan kecuali jelas dikonfirmasi. Verifikasi model relevan, ukuran, materi, spesifikasi atau penggunaan persyaratan sebelum pembelian.', '', NULL, 4, true),
('policy_seed_id_terms_290', 'terms', 'id', 'Perangkat lunak dan item digital', 'Perangkat lunak, kunci aktivasi, langganan dan produk digital diatur oleh istilah penerbit mereka. Dikirim atau diaktifkan kredensial mungkin tidak dapat dikembalikan kecuali di mana secara hukum diperlukan atau terbukti cacat.

Anda tidak harus menjual ulang, menyalin, kontrol lisensi bypass atau menggunakan produk digital di luar lisensi yang diizinkan.', '', NULL, 5, true),
('policy_seed_id_terms_291', 'terms', 'id', 'Akun dan penggunaan yang dapat diterima', 'Simpan informasi rekening dan kontak secara akurat dan lindungi kredensial Anda. Anda bertanggung jawab untuk aktivitas akun kecuali penggunaan tidak sah segera dilaporkan.

penyalahgunaan otomatis, penipuan, penggunaan melanggar hukum, gangguan dengan layanan, klaim palsu dan upaya untuk mengakses sistem terlarang dilarang.', '', NULL, 6, true),
('policy_seed_id_terms_292', 'terms', 'id', 'Membatalkan, kembali dan kewajiban', 'Membatalkan dan mengembalikan keabsahan mengikuti status urutan dan kebijakan pengembalian yang diterbitkan. Waktu pengembalian dana juga dapat bergantung pada penyedia pembayaran.

Sejauh yang diijinkan oleh hukum yang berlaku, kewajiban terbatas untuk kerugian langsung terhubung ke urutan yang terpengaruh. Hak yang secara hukum tidak dapat dikeluarkan tetap tidak terpengaruh.', '', NULL, 7, true),
('policy_seed_id_terms_293', 'terms', 'id', 'Perubahan kebijakan dan kontak', 'Kita dapat memperbarui istilah ini untuk mencerminkan operasional, perubahan hukum atau layanan. Tanggal efektif mengidentifikasi versi saat ini. Dukungan kontak sebelum memesan jika ada kondisi yang tidak jelas.

Dukungan kontak

Baca kebijakan pengembalian', '', NULL, 8, true),
('policy_seed_id_faq_294', 'faq', 'id', 'Apa yang bisa aku beli dari toko ini?', 'Jangkauan kami yang tersedia diselenggarakan oleh kategori hidup yang ditampilkan di toko. Ramban kategori atau cari katalog untuk melihat apa yang sedang ditawarkan.', 'Informasi umum', NULL, 0, true),
('policy_seed_id_faq_295', 'faq', 'id', 'Berapa besar koleksi produkmu?', 'Koleksi produk kami terus tumbuh dan diperbarui secara teratur dengan pendatang baru dan persediaan saat ini.', 'Informasi umum', NULL, 1, true),
('policy_seed_id_faq_296', 'faq', 'id', 'Bagaimana saya bisa mengkonfirmasi kompatibilitas produk?', 'Bandingkan model, antar muka, dimensi dan persyaratan lainnya dalam spesifikasi. Dukungan kontak sebelum memesan jika kompatibilitas tidak jelas.', 'Informasi umum', NULL, 2, true),
('policy_seed_id_faq_297', 'faq', 'id', 'Bagaimana cara membuat rekening?', 'Buka Log Masuk atau Masuk, pilih Register, dan buat akun dengan namamu, surel dan kata sandi.', 'Informasi umum', NULL, 3, true),
('policy_seed_id_faq_298', 'faq', 'id', 'Apakah saya perlu account untuk menempatkan perintah?', 'Checkout tamu mungkin tersedia. Sebuah akun membuatnya lebih mudah untuk melacak perintah dan menggunakan fitur akun.', 'Memerintah dan pembayaran', NULL, 4, true),
('policy_seed_id_faq_299', 'faq', 'id', 'Metode pembayaran mana yang kau dukung?', 'Metode pembayaran tersedia muncul selama checkout dan dapat mencakup pembayaran mobile, kartu dan uang tunai pada pengiriman.', 'Memerintah dan pembayaran', NULL, 5, true),
('policy_seed_id_faq_300', 'faq', 'id', 'Dapatkah saya membatalkan pesanan saya?', 'Pembatalan tergantung pada status urutan. Buka rincian perintah Anda untuk memeriksa aksi atau dukungan kontak yang tersedia.', 'Memerintah dan pembayaran', NULL, 6, true),
('policy_seed_id_faq_301', 'faq', 'id', 'Apakah pembayaran saya aman?', 'Checkout menggunakan penyedia pembayaran yang didukung dan penanganan aman. Kredensial pembayaran sensitif tidak disimpan oleh toko.', 'Memerintah dan pembayaran', NULL, 7, true),
('policy_seed_id_faq_302', 'faq', 'id', 'Bagaimana aku akan menerima konfirmasi perintah?', 'Konfirmasi dan pembaruan status dapat muncul di akun Anda dan mungkin juga dikirim melalui surel atau saluran SMS yang dikonfigurasi.', 'Memerintah dan pembayaran', NULL, 8, true),
('policy_seed_id_faq_303', 'faq', 'id', 'Berapa biaya pengiriman?', 'Biaya pengiriman tergantung pada daerah pengiriman, kereta dan aturan pengiriman saat ini. Jumlah terakhir ditunjukkan pada checkout.', 'Pengiriman dan pengiriman', NULL, 9, true),
('policy_seed_id_faq_304', 'faq', 'id', 'Berapa lama pengiriman berlangsung?', 'Perkiraan tergantung pada lokasi inventaris, tujuan dan cakupan kurir dan ditampilkan selama pemeriksaan atau pemrosesan pesanan.', 'Pengiriman dan pengiriman', NULL, 10, true),
('policy_seed_id_faq_305', 'faq', 'id', 'Di mana Anda memberikan?', 'Ketersediaan pengiriman tergantung pada cakupan kurir aktif dan alamat yang dimasukkan selama checkout.', 'Pengiriman dan pengiriman', NULL, 11, true),
('policy_seed_id_faq_306', 'faq', 'id', 'Bagaimana saya bisa melacak pesanan saya?', 'Buka Perintahku dan pilih perintah untuk melihat status dan pengiriman yang tersedia.', 'Pengiriman dan pengiriman', NULL, 12, true),
('policy_seed_id_faq_307', 'faq', 'id', 'Apakah Anda menawarkan pengiriman ekspres?', 'Pengantar ekspres atau lebih cepat mungkin muncul ketika didukung untuk alamat dan urutan yang dipilih.', 'Pengiriman dan pengiriman', NULL, 13, true),
('policy_seed_id_faq_308', 'faq', 'id', 'Dapatkah saya kembali produk?', 'Produk dapat dikembalikan dalam jendela yang bisa diterapkan untuk alasan yang didukung seperti kerusakan, cacat atau item yang salah.', 'Kembali dan pengembalian dana', NULL, 14, true),
('policy_seed_id_faq_309', 'faq', 'id', 'Bagaimana proses pengembalian dana bekerja?', 'Setelah persetujuan, kembali dan inspeksi, pengembalian dana dikeluarkan melalui metode yang disetujui. Waktu pemrosesan penyedia mungkin bervariasi.', 'Kembali dan pengembalian dana', NULL, 15, true),
('policy_seed_id_faq_310', 'faq', 'id', 'Dapatkah saya bertukar produk?', 'Pertukaran mungkin tersedia tergantung pada alasan pengembalian, produk eligibilitas dan saham saat ini.', 'Kembali dan pengembalian dana', NULL, 16, true),
('policy_seed_id_faq_311', 'faq', 'id', 'Apa yang harus kulakukan jika aku lupa kata sandiku?', 'Gunakan Sandi Lupa pada halaman masuk, masukkan email terdaftar Anda dan ikuti instruksi reset.', 'Akun dan profil', NULL, 17, true),
('policy_seed_id_faq_312', 'faq', 'id', 'Bagaimana cara memperbarui profilku?', 'Buka profil akun Anda untuk memperbarui informasi pribadi dan kontak yang tersedia.', 'Akun dan profil', NULL, 18, true),
('policy_seed_id_faq_313', 'faq', 'id', 'Bagaimana saya bisa melihat sejarah pesanan saya?', 'Buka Akun-ku dan pilih Perintah-Ku untuk melihat saat ini dan pembelian sebelumnya.', 'Akun dan profil', NULL, 19, true),
('policy_seed_id_faq_314', 'faq', 'id', 'Bagaimana cara mengatur alamat yang disimpan?', 'Buka bagian alamat di akun Anda untuk menambahkan, menyunting, atau menghapus alamat pengiriman yang tersimpan.', 'Akun dan profil', NULL, 20, true),
('policy_seed_id_faq_315', 'faq', 'id', 'Bagaimana saya tahu apakah sebuah produk di saham?', 'Halaman produk menunjukkan ketersediaannya saat ini. Saham bisa berubah sampai perintah dikonfirmasi.', 'Memproduksi dan ketersediaan', NULL, 21, true),
('policy_seed_id_faq_316', 'faq', 'id', 'Apakah harga produk berubah?', 'Harga dan promosi mungkin berubah. Total checkout dikonfirmasi adalah harga yang berlaku untuk perintah yang diajukan.', 'Memproduksi dan ketersediaan', NULL, 22, true),
('policy_seed_id_faq_317', 'faq', 'id', 'Di mana saya bisa menemukan spesifikasi?', 'Buka halaman produk dan tinjau deskripsi, atribut, varian dan bagian spesifikasi.', 'Memproduksi dan ketersediaan', NULL, 23, true),
('policy_seed_id_faq_318', 'faq', 'id', 'Dapatkah saya membandingkan produk?', 'Gunakan kategori yang tersedia, penyaring dan rincian produk untuk membandingkan pilihan, atau dukungan kontak untuk bimbingan.', 'Memproduksi dan ketersediaan', NULL, 24, true),
('policy_seed_id_sitemap_319', 'sitemap', 'id', 'Kebijakan Pengiriman', '', '', '/ecommerce/shipping', 0, true),
('policy_seed_id_sitemap_320', 'sitemap', 'id', 'Kebijakan Pengembalian', '', '', '/ecommerce/returns', 1, true),
('policy_seed_id_sitemap_321', 'sitemap', 'id', 'Kebijakan Privasi', '', '', '/ecommerce/privacy', 2, true),
('policy_seed_id_sitemap_322', 'sitemap', 'id', 'Tanya Jawab', '', '', '/ecommerce/faq', 3, true),
('policy_seed_id_sitemap_323', 'sitemap', 'id', 'Ketentuan Layanan', '', '', '/ecommerce/terms', 4, true);
