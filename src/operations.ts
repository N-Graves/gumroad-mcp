/**
 * Every Gumroad v2 operation, so the fleet has the whole API rather than the
 * slice somebody happened to wrap (Nathan, 2026-08-20: "all of them, i want
 * full control via api").
 *
 * HAND-WRITTEN, unlike etsy-mcp's generated table, and that difference is
 * forced rather than chosen: Gumroad publishes no OpenAPI spec. Every entry
 * here was read off Gumroad's own `config/routes.rb` and, where the parameters
 * mattered, the controller behind it - not from a documentation page. This
 * project has been burned repeatedly by docs advertising endpoints that do not
 * exist, and by an AI-written mirror that happened to be right this time.
 *
 * The 20 bespoke tools stay. `wrappedBy` marks the operations they already
 * cover, so this table is a complete map of the API rather than a list of
 * leftovers - one place to look, which is the point of a catalogue.
 *
 * Excluded on purpose: the `/v2/walks/*` namespace. Those five endpoints belong
 * to Gumroad's own iOS app (device attestation, OpenAI realtime tokens) and are
 * not a seller API at all.
 */

export type OperationTier = "read" | "financial" | "write" | "destructive";

export interface GumroadOperation {
  name: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  pathParams: string[];
  tier: OperationTier;
  summary: string;
  /** Body/query parameters worth naming. Not exhaustive - Gumroad ignores unknown keys. */
  params?: string[];
  /** The bespoke tool that already covers this, if any. */
  wrappedBy?: string;
}

export const OPERATIONS: GumroadOperation[] = [
  // ---------------------------------------------------------------- products
  { name: "listProducts", method: "GET", path: "/products", pathParams: [], tier: "read",
    summary: "All products", params: ["page_key"], wrappedBy: "gumroad_get_products" },
  { name: "getProduct", method: "GET", path: "/products/{id}", pathParams: ["id"], tier: "read",
    summary: "One product", wrappedBy: "gumroad_get_product" },
  { name: "createProduct", method: "POST", path: "/products", pathParams: [], tier: "write",
    summary: "Create a product (as a DRAFT with purchases disabled)",
    params: ["name", "price", "description", "native_type", "tags", "taxonomy_id"],
    wrappedBy: "gumroad_create_product" },
  { name: "updateProduct", method: "PUT", path: "/products/{id}", pathParams: ["id"], tier: "write",
    summary: "Update product metadata", wrappedBy: "gumroad_update_product" },
  { name: "deleteProduct", method: "DELETE", path: "/products/{id}", pathParams: ["id"], tier: "destructive",
    summary: "Permanently delete a product", wrappedBy: "gumroad_delete_product" },
  { name: "enableProduct", method: "PUT", path: "/products/{id}/enable", pathParams: ["id"], tier: "write",
    summary: "Publish a product", wrappedBy: "gumroad_enable_product" },
  { name: "disableProduct", method: "PUT", path: "/products/{id}/disable", pathParams: ["id"], tier: "write",
    summary: "Take a product off sale (keeps the listing)", wrappedBy: "gumroad_disable_product" },
  { name: "getProductComps", method: "GET", path: "/products/comps", pathParams: [], tier: "read",
    summary: "Comparable products and price points, for pricing a new one" },

  // ------------------------------------------------------------------ images
  { name: "addProductCover", method: "POST", path: "/products/{id}/covers", pathParams: ["id"], tier: "write",
    summary: "Add a cover image", params: ["url", "signed_blob_id"], wrappedBy: "gumroad_set_product_cover" },
  { name: "deleteProductCover", method: "DELETE", path: "/products/{id}/covers/{cover_id}",
    pathParams: ["id", "cover_id"], tier: "destructive", summary: "Remove one cover image" },
  { name: "setProductThumbnail", method: "POST", path: "/products/{id}/thumbnail", pathParams: ["id"], tier: "write",
    summary: "Set the listing/search thumbnail", params: ["url", "signed_blob_id"],
    wrappedBy: "gumroad_set_product_thumbnail" },
  { name: "deleteProductThumbnail", method: "DELETE", path: "/products/{id}/thumbnail", pathParams: ["id"],
    tier: "destructive", summary: "Remove the thumbnail" },

  // -------------------------------------------------- variants / price tiers
  { name: "listVariantCategories", method: "GET", path: "/products/{id}/variant_categories", pathParams: ["id"],
    tier: "read", summary: "Variant categories (e.g. 'Format', 'Tier')" },
  { name: "createVariantCategory", method: "POST", path: "/products/{id}/variant_categories", pathParams: ["id"],
    tier: "write", summary: "Create a variant category", params: ["title"] },
  { name: "getVariantCategory", method: "GET", path: "/products/{id}/variant_categories/{category_id}",
    pathParams: ["id", "category_id"], tier: "read", summary: "One variant category" },
  { name: "updateVariantCategory", method: "PUT", path: "/products/{id}/variant_categories/{category_id}",
    pathParams: ["id", "category_id"], tier: "write", summary: "Rename a variant category", params: ["title"] },
  { name: "deleteVariantCategory", method: "DELETE", path: "/products/{id}/variant_categories/{category_id}",
    pathParams: ["id", "category_id"], tier: "destructive", summary: "Delete a variant category" },
  { name: "listVariants", method: "GET", path: "/products/{id}/variant_categories/{category_id}/variants",
    pathParams: ["id", "category_id"], tier: "read", summary: "Variants in a category" },
  { name: "createVariant", method: "POST", path: "/products/{id}/variant_categories/{category_id}/variants",
    pathParams: ["id", "category_id"], tier: "write",
    summary: "Create a variant - this is how a product gets pricing tiers",
    params: ["name", "price_difference_cents", "max_purchase_count"] },
  { name: "getVariant", method: "GET", path: "/products/{id}/variant_categories/{category_id}/variants/{variant_id}",
    pathParams: ["id", "category_id", "variant_id"], tier: "read", summary: "One variant" },
  { name: "updateVariant", method: "PUT", path: "/products/{id}/variant_categories/{category_id}/variants/{variant_id}",
    pathParams: ["id", "category_id", "variant_id"], tier: "write", summary: "Update a variant",
    params: ["name", "price_difference_cents", "max_purchase_count"] },
  { name: "deleteVariant", method: "DELETE", path: "/products/{id}/variant_categories/{category_id}/variants/{variant_id}",
    pathParams: ["id", "category_id", "variant_id"], tier: "destructive", summary: "Delete a variant" },
  { name: "listSkus", method: "GET", path: "/products/{id}/skus", pathParams: ["id"], tier: "read",
    summary: "SKUs (the concrete variant combinations)" },

  // ----------------------------------------------------------- custom fields
  { name: "listCustomFields", method: "GET", path: "/products/{id}/custom_fields", pathParams: ["id"],
    tier: "read", summary: "Checkout custom fields" },
  { name: "createCustomField", method: "POST", path: "/products/{id}/custom_fields", pathParams: ["id"],
    tier: "write", summary: "Add a checkout field (e.g. 'Pet name')", params: ["name", "required", "type"] },
  { name: "updateCustomField", method: "PUT", path: "/products/{id}/custom_fields/{field_id}",
    pathParams: ["id", "field_id"], tier: "write", summary: "Update a checkout field" },
  { name: "deleteCustomField", method: "DELETE", path: "/products/{id}/custom_fields/{field_id}",
    pathParams: ["id", "field_id"], tier: "destructive", summary: "Remove a checkout field" },

  // ------------------------------------------------------------- offer codes
  { name: "listOfferCodes", method: "GET", path: "/products/{id}/offer_codes", pathParams: ["id"], tier: "read",
    summary: "Discount codes", wrappedBy: "gumroad_get_offer_codes" },
  { name: "getOfferCode", method: "GET", path: "/products/{id}/offer_codes/{offer_code_id}",
    pathParams: ["id", "offer_code_id"], tier: "read", summary: "One discount code",
    wrappedBy: "gumroad_get_offer_code" },
  { name: "createOfferCode", method: "POST", path: "/products/{id}/offer_codes", pathParams: ["id"],
    tier: "write", summary: "Create a discount code", wrappedBy: "gumroad_create_offer_code" },
  { name: "updateOfferCode", method: "PUT", path: "/products/{id}/offer_codes/{offer_code_id}",
    pathParams: ["id", "offer_code_id"], tier: "write", summary: "Update a discount code",
    wrappedBy: "gumroad_update_offer_code" },
  { name: "deleteOfferCode", method: "DELETE", path: "/products/{id}/offer_codes/{offer_code_id}",
    pathParams: ["id", "offer_code_id"], tier: "destructive", summary: "Delete a discount code",
    wrappedBy: "gumroad_delete_offer_code" },

  // ------------------------------------------------------------------ sales
  { name: "listSales", method: "GET", path: "/sales", pathParams: [], tier: "financial",
    summary: "Sales, one row each", params: ["after", "before", "product_id", "email", "page_key"],
    wrappedBy: "gumroad_get_sales" },
  { name: "getSalesSummary", method: "GET", path: "/sales/summary", pathParams: [], tier: "financial",
    summary: "Gross/net/units totals", params: ["after", "before"], wrappedBy: "gumroad_get_sales_summary" },
  { name: "getSale", method: "GET", path: "/sales/{id}", pathParams: ["id"], tier: "financial",
    summary: "One sale in full" },
  { name: "exportSales", method: "POST", path: "/sales/exports", pathParams: [], tier: "financial",
    summary: "Request a sales export", params: ["after", "before"] },
  { name: "markSaleShipped", method: "PUT", path: "/sales/{id}/mark_as_shipped", pathParams: ["id"],
    tier: "write", summary: "Mark a physical order shipped", params: ["tracking_url"] },
  { name: "refundSale", method: "PUT", path: "/sales/{id}/refund", pathParams: ["id"], tier: "destructive",
    summary: "REFUND a sale - this moves real money back to the buyer and cannot be undone",
    params: ["amount_cents"] },
  { name: "resendReceipt", method: "POST", path: "/sales/{id}/resend_receipt", pathParams: ["id"],
    tier: "write", summary: "Resend a buyer's receipt email" },

  // ------------------------------------------------------------------ money
  { name: "listPayouts", method: "GET", path: "/payouts", pathParams: [], tier: "financial",
    summary: "Past payouts", wrappedBy: "gumroad_get_payouts" },
  { name: "getUpcomingPayout", method: "GET", path: "/payouts/upcoming", pathParams: [], tier: "financial",
    summary: "The next scheduled payout", wrappedBy: "gumroad_get_payouts" },
  { name: "getPayout", method: "GET", path: "/payouts/{id}", pathParams: ["id"], tier: "financial",
    summary: "One payout in full" },
  { name: "getEarnings", method: "GET", path: "/earnings", pathParams: [], tier: "financial",
    summary: "Earnings overview. NEEDS 'Tax center' enabled on the Gumroad account - it is not " +
             "on this one, and returns 'Tax center is not enabled for this account.' That is an " +
             "account setting, not a fault: do not retry it, use getSalesSummary instead." },
  { name: "listTaxForms", method: "GET", path: "/tax_forms", pathParams: [], tier: "financial",
    summary: "Available tax forms by year. NEEDS 'Tax center' enabled on the account - not on " +
             "at present, returns 'Tax center is not enabled for this account.' Not a fault." },
  { name: "downloadTaxForm", method: "GET", path: "/tax_forms/{year}/{tax_form_type}/download",
    pathParams: ["year", "tax_form_type"], tier: "financial",
    summary: "Download a tax form. Same 'Tax center' account requirement as listTaxForms." },

  // ---------------------------------------------------------------- customers
  { name: "listProductSubscribers", method: "GET", path: "/products/{id}/subscribers", pathParams: ["id"],
    tier: "financial", summary: "Subscribers to a membership product" },
  { name: "getSubscriber", method: "GET", path: "/subscribers/{id}", pathParams: ["id"], tier: "financial",
    summary: "One subscriber" },
  { name: "listProductReviews", method: "GET", path: "/products/{id}/reviews", pathParams: ["id"], tier: "read",
    summary: "Public reviews on a product page, with submission dates" },

  // ------------------------------------------------------------------ account
  { name: "getUser", method: "GET", path: "/user", pathParams: [], tier: "read",
    summary: "The seller account", wrappedBy: "gumroad_get_user" },
  { name: "updateUser", method: "PUT", path: "/user", pathParams: [], tier: "write",
    summary: "Update seller profile", params: ["name", "bio", "twitter_handle"] },
  { name: "getTheme", method: "GET", path: "/user/theme", pathParams: [], tier: "read",
    summary: "Storefront colours and font (read-only - no self-serve editor)" },
  { name: "getProfileLayout", method: "GET", path: "/user/profile_layout", pathParams: [], tier: "read",
    summary: "Storefront tabs and sections" },
  { name: "getUserCustomHtml", method: "GET", path: "/user/custom_html", pathParams: [], tier: "read",
    summary: "The profile page's custom HTML" },
  { name: "updateUserCustomHtml", method: "PUT", path: "/user/custom_html", pathParams: [], tier: "write",
    summary: "Replace the profile page's custom HTML", params: ["html"] },
  { name: "editUserCustomHtml", method: "POST", path: "/user/custom_html/edit", pathParams: [], tier: "write",
    summary: "Patch the profile page's custom HTML" },
  { name: "previewUserCustomHtml", method: "POST", path: "/user/preview_custom_html", pathParams: [],
    tier: "write", summary: "Render a preview without saving", params: ["html"] },
  { name: "listCategories", method: "GET", path: "/categories", pathParams: [], tier: "read",
    summary: "Taxonomy categories and their ids", wrappedBy: "gumroad_get_categories" },
  { name: "getRefundPolicy", method: "GET", path: "/refund_policy", pathParams: [], tier: "read",
    summary: "Account-level refund policy" },
  { name: "updateRefundPolicy", method: "PUT", path: "/refund_policy", pathParams: [], tier: "write",
    summary: "Set the account-level refund policy", params: ["refund_period_in_days", "fine_print"] },

  // -------------------------------------------------------- storefront pages
  { name: "listPages", method: "GET", path: "/pages", pathParams: [], tier: "read",
    summary: "Storefront pages" },
  { name: "getPage", method: "GET", path: "/pages/{id}", pathParams: ["id"], tier: "read",
    summary: "One storefront page" },
  { name: "createPage", method: "POST", path: "/pages", pathParams: [], tier: "write",
    summary: "Create a storefront page", params: ["slug", "title", "html"] },
  { name: "updatePage", method: "PUT", path: "/pages/{id}", pathParams: ["id"], tier: "write",
    summary: "Update a storefront page" },
  { name: "deletePage", method: "DELETE", path: "/pages/{id}", pathParams: ["id"], tier: "destructive",
    summary: "Delete a storefront page" },
  { name: "listMedia", method: "GET", path: "/media", pathParams: [], tier: "read",
    summary: "Public media library (images usable on custom pages)" },
  { name: "createMedia", method: "POST", path: "/media", pathParams: [], tier: "write",
    summary: "Add an image to the media library", params: ["url", "signed_blob_id"] },
  { name: "deleteMedia", method: "DELETE", path: "/media/{id}", pathParams: ["id"], tier: "destructive",
    summary: "Remove an image from the media library" },
  { name: "getProductCustomHtml", method: "GET", path: "/products/{id}/custom_html", pathParams: ["id"],
    tier: "read", summary: "A product page's custom HTML" },
  { name: "editProductCustomHtml", method: "POST", path: "/products/{id}/custom_html/edit", pathParams: ["id"],
    tier: "write", summary: "Patch a product page's custom HTML" },
  { name: "previewProductCustomHtml", method: "POST", path: "/products/{id}/preview_custom_html",
    pathParams: ["id"], tier: "write", summary: "Render a product page preview without saving" },
  { name: "updateBundleContents", method: "PUT", path: "/products/{id}/bundle_contents", pathParams: ["id"],
    tier: "write", summary: "Set what a bundle product contains", params: ["products"] },

  // -------------------------------------------------------------- marketing
  { name: "listUpsells", method: "GET", path: "/upsells", pathParams: [], tier: "read", summary: "Upsells" },
  { name: "getUpsell", method: "GET", path: "/upsells/{id}", pathParams: ["id"], tier: "read", summary: "One upsell" },
  { name: "createUpsell", method: "POST", path: "/upsells", pathParams: [], tier: "write",
    summary: "Create an upsell / cross-sell" },
  { name: "updateUpsell", method: "PUT", path: "/upsells/{id}", pathParams: ["id"], tier: "write", summary: "Update an upsell" },
  { name: "deleteUpsell", method: "DELETE", path: "/upsells/{id}", pathParams: ["id"], tier: "destructive", summary: "Delete an upsell" },
  { name: "listUtmLinks", method: "GET", path: "/utm_links", pathParams: [], tier: "read", summary: "UTM tracking links" },
  { name: "getUtmLink", method: "GET", path: "/utm_links/{id}", pathParams: ["id"], tier: "read", summary: "One UTM link" },
  { name: "createUtmLink", method: "POST", path: "/utm_links", pathParams: [], tier: "write",
    summary: "Create a UTM tracking link - how you attribute a sale to a campaign" },
  { name: "updateUtmLink", method: "PUT", path: "/utm_links/{id}", pathParams: ["id"], tier: "write", summary: "Update a UTM link" },
  { name: "deleteUtmLink", method: "DELETE", path: "/utm_links/{id}", pathParams: ["id"], tier: "destructive", summary: "Delete a UTM link" },
  { name: "enableUtmLink", method: "PUT", path: "/utm_links/{id}/enable", pathParams: ["id"], tier: "write", summary: "Enable a UTM link" },
  { name: "disableUtmLink", method: "PUT", path: "/utm_links/{id}/disable", pathParams: ["id"], tier: "write", summary: "Disable a UTM link" },
  { name: "listEmails", method: "GET", path: "/emails", pathParams: [], tier: "read", summary: "Email broadcasts" },
  { name: "getEmail", method: "GET", path: "/emails/{id}", pathParams: ["id"], tier: "read", summary: "One email" },
  { name: "createEmail", method: "POST", path: "/emails", pathParams: [], tier: "write",
    summary: "Draft an email broadcast (drafting is not sending)", params: ["subject", "message"] },
  { name: "deleteEmail", method: "DELETE", path: "/emails/{id}", pathParams: ["id"], tier: "destructive", summary: "Delete an email" },
  { name: "previewEmail", method: "POST", path: "/emails/{id}/preview", pathParams: ["id"], tier: "write",
    summary: "Send a preview to yourself" },
  { name: "sendEmail", method: "POST", path: "/emails/{id}/send", pathParams: ["id"], tier: "destructive",
    summary: "SEND an email broadcast to real customers - cannot be recalled" },
  { name: "scheduleEmail", method: "POST", path: "/emails/{id}/schedule", pathParams: ["id"], tier: "destructive",
    summary: "Schedule a broadcast to real customers", params: ["send_at"] },
  { name: "unscheduleEmail", method: "POST", path: "/emails/{id}/unschedule", pathParams: ["id"], tier: "write",
    summary: "Cancel a scheduled broadcast" },
  { name: "listWorkflows", method: "GET", path: "/workflows", pathParams: [], tier: "read", summary: "Automated email workflows" },
  { name: "getWorkflow", method: "GET", path: "/workflows/{id}", pathParams: ["id"], tier: "read", summary: "One workflow" },
  { name: "createWorkflowEmail", method: "POST", path: "/workflows/{id}/emails", pathParams: ["id"], tier: "write",
    summary: "Add an email to a workflow" },
  { name: "updateWorkflowEmail", method: "PUT", path: "/workflows/{id}/emails/{email_id}",
    pathParams: ["id", "email_id"], tier: "write", summary: "Update a workflow email" },

  // --------------------------------------------------------------- licences
  { name: "verifyLicense", method: "POST", path: "/licenses/verify", pathParams: [], tier: "read",
    summary: "Verify a licence key", params: ["product_id", "license_key", "increment_uses_count"] },
  { name: "enableLicense", method: "PUT", path: "/licenses/enable", pathParams: [], tier: "write",
    summary: "Enable a licence key", params: ["product_id", "license_key"] },
  { name: "disableLicense", method: "PUT", path: "/licenses/disable", pathParams: [], tier: "write",
    summary: "Disable a licence key", params: ["product_id", "license_key"] },
  { name: "rotateLicense", method: "PUT", path: "/licenses/rotate", pathParams: [], tier: "write",
    summary: "Issue a new key in place of one", params: ["product_id", "license_key"] },
  { name: "decrementLicenseUses", method: "PUT", path: "/licenses/decrement_uses_count", pathParams: [],
    tier: "write", summary: "Give a seat back", params: ["product_id", "license_key"] },

  // --------------------------------------------------------------- webhooks
  { name: "listWebhooks", method: "GET", path: "/resource_subscriptions", pathParams: [], tier: "read",
    summary: "Webhook subscriptions for ONE event - resource_name is REQUIRED, not optional " +
             "(sale, refund, cancellation, dispute, dispute_won, subscription_ended, " +
             "subscription_restarted, subscription_updated). Without it Gumroad answers " +
             "'Valid resource_name parameter required', which reads like a broken tool.",
    params: ["resource_name"] },
  { name: "createWebhook", method: "PUT", path: "/resource_subscriptions", pathParams: [], tier: "write",
    summary: "Subscribe to an event - push instead of polling /sales. resource_name is one of: " +
             "sale, refund, cancellation, dispute, dispute_won, subscription_ended, " +
             "subscription_restarted, subscription_updated. post_url is where Gumroad POSTs.",
    params: ["resource_name", "post_url"] },
  { name: "deleteWebhook", method: "DELETE", path: "/resource_subscriptions/{id}", pathParams: ["id"],
    tier: "destructive", summary: "Remove a webhook subscription" },

  // ------------------------------------------------------------------- misc
  { name: "listHelpArticles", method: "GET", path: "/help/articles", pathParams: [], tier: "read",
    summary: "Gumroad's own help centre, as plain text - check how a feature really works" },
  { name: "getHelpArticle", method: "GET", path: "/help/articles/{slug}", pathParams: ["slug"], tier: "read",
    summary: "One help article" },
];

export const OPERATIONS_BY_NAME = new Map(OPERATIONS.map((o) => [o.name, o]));
