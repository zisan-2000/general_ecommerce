# Google Analytics and ecommerce events

## Configuration

Use **Admin → General Settings → Google Analytics & Tag Manager** to set:

- `googleTrackingEnabled`: master switch for all Google tracking.
- `googleTagManagerEnabled` and `googleTagManagerId`: enable the GTM web container.
- `googleAnalyticsEnabled` and `googleAnalyticsMeasurementId`: enable direct GA4 only when GTM is disabled.
- `googleAnalyticsDebugMode`: add GA4 debug mode to outgoing events.

IDs are trimmed and validated before saving. Empty IDs are stored as `null`; an enabled integration requires a valid ID. GTM has priority when both delivery toggles are on. The IDs are public identifiers, not credentials. The status shown in the admin UI confirms configuration only; it does not verify a Google account or live connection.

GTM is loaded asynchronously by the root layout when GTM is the selected delivery mode. Its `noscript` iframe is rendered inside `<body>` only in that mode. Direct GA4 is initialized with automatic page views disabled. Neither script is emitted when Google tracking is disabled.

## Delivery and GTM setup

In GTM, create one **Custom Event** trigger per event below, using the exact trigger name. Attach a GA4 Event tag to each trigger and map its event name to the same name. Configure the GA4 Configuration/Google tag to **not** send an automatic page view; the app sends route page views itself.

For ecommerce tags, consume the `ecommerce` object from the data layer. The app clears it before each ecommerce event, then pushes `{ event, ecommerce }` to avoid stale item values carrying into later events. GTM must not also generate duplicate ecommerce events from click triggers.

`session_start` is sent as a data-layer signal only in GTM mode. Do not map it to a GA4 Event tag: GA4 creates its own session-start event. In direct mode, GA4 handles the native event.

| Event | App trigger/location | Important parameters |
|---|---|---|
| `page_view` | Storefront route change on `/` and `/ecommerce/*` | `page_location`, `page_path`, `page_title` |
| `session_start` | First storefront page in a browser session / after 30 minutes idle (GTM signal only) | No ecommerce object |
| `view_item` | Product detail page rendered | `currency`, `value`, `items` |
| `view_item_list` | Visible catalog grid, related-products rail, homepage best sellers/featured/new arrivals, or flash-sale list | `item_list_id`, `item_list_name`, `items` |
| `select_item` | Product link selected in one of those product lists | `item_list_id`, `item_list_name`, selected `items` |
| `add_to_cart` | Cart state changes after a successful add | `currency`, `value`, `items` |
| `remove_from_cart` | Cart state changes after a successful remove/quantity reduction | `currency`, `value`, `items` |
| `view_cart` | Cart becomes ready with at least one item | `currency`, `value`, `items` |
| `begin_checkout` | Checkout becomes ready with at least one item | `currency`, `value`, `items`, optional `coupon` |
| `add_shipping_info` | Valid address advances checkout to payment, when a shipping quote is available | `currency`, `value`, `shipping`, `shipping_tier`, `items` |
| `add_payment_info` | A new order is successfully persisted | `currency`, `value`, generic `payment_type`, `items` |
| `purchase` | New order creation returns HTTP 201 with persisted order items | `transaction_id`, `currency`, merchandise `value`, `tax`, `shipping`, optional `coupon`, `items` |
| `refund` | Customer next views an order after its refund payout is completed | `transaction_id`, `currency`, refund `value`, `items` |
| `add_to_wishlist` | Wishlist API add succeeds | `currency`, `value`, `items` |
| `view_promotion` | Flash-sale placement enters the viewport | `promotion_id`, `promotion_name`, `items` |
| `select_promotion` | Product link selected from the flash-sale placement | `promotion_id`, `promotion_name`, selected `items` |

The catalog item converter only includes available product data (ID, name, price, brand/category when present, variant, discount and list index). The currency comes from the saved order/product or the store currency settings; it is not fixed to USD.

## Duplicate delivery and purchase behavior

GTM is the primary delivery mechanism when enabled. Direct GA4 is used only when GTM is disabled, so one app event is not sent through both routes. Keep page-view tracking disabled in the GTM GA4 Configuration tag to avoid duplicating the app's route event.

`purchase` represents **persisted order placement**, not successful payment settlement. It is emitted only for a newly created order (HTTP 201), after the order API returns the saved order and its items. Order replays (HTTP 200) are not emitted. The browser also records `analytics_purchase_<orderId>` in local storage and an in-memory set, preventing repeats after refresh in that browser. GA4's `transaction_id` is the order ID.

Refunds are emitted only for records with both `status=COMPLETED` and `payoutStatus=PAID`. Since payout is performed by an administrator rather than from the customer's storefront session, the event is sent when the customer next loads that order detail page; it is not sent from the admin browser. `analytics_refund_<refundId>` prevents repeats in the customer's browser.

## Privacy and consent

The Google event builder uses an explicit allowlist; it does not spread customer, address, account, uploaded payment, or gateway objects. Checkout payment types are reduced to `cash_on_delivery`, `online_payment`, or `manual_payment`. Page locations omit query strings and fragments; private account routes are excluded from Google page views. Product/order identifiers and public catalog data are used only where ecommerce reporting requires them.

The integration exposes a consent setter for a future consent-management platform, but no consent banner/platform is wired here. Until one is integrated, Google tracking is controlled by the admin master switch and is otherwise enabled for storefront visitors when configured. Apply the consent requirements for your jurisdictions before enabling it.
