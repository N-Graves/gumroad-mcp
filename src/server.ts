import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequest,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { config } from "dotenv";

import { GumroadClient } from "./gumroad-client.js";
import { requireCapability } from "./agent-capability.js";
import { OPERATIONS } from "./operations.js";
import { dispatch, CONFIRM_REQUIRED } from "./dispatch.js";

config();

const REQUIRED_CAPABILITY = "listings"; // PUBLISHER owns Gumroad listings/catalog
const AGENT_ID_PROPERTY = { agent_id: { type: "string", description: "Your fleet-board agent id, e.g. 'publisher'" } };

const getProducts: Tool = {
  name: "gumroad_get_products",
  description: "Retrieves all of the products",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

const getSales: Tool = {
  name: "gumroad_get_sales",
  description: "Retrieves all of the successful sales",
  inputSchema: {
    type: "object",
    properties: {
      after: {
        type: "string",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        description: "Only return sales after this date (YYYY-MM-DD)",
      },
      before: {
        type: "string",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        description: "Only return sales before this date (YYYY-MM-DD)",
      },
      product_id: { type: "string", description: "Filter sales by this product" },
      email: { type: "string", description: "Filter sales by this email" },
      order_id: { type: "string", description: "Filter sales by this Order ID" },
      page_key: { type: "string", description: "A key representing a page of results" },
    },
  },
};

const getProduct: Tool = {
  name: "gumroad_get_product",
  description: "Retrieves a single product by its ID",
  inputSchema: {
    type: "object",
    properties: {
      product_id: { type: "string", description: "The ID of the product to retrieve" },
    },
    required: ["product_id"],
  },
};

const getUser: Tool = {
  name: "gumroad_get_user",
  description: "Retrieves the authenticated user's data. Available with any scope.",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

const disableProduct: Tool = {
  name: "gumroad_disable_product",
  description: "Disables a product by its ID. Requires agent_id (must hold the 'listings' capability).",
  inputSchema: {
    type: "object",
    properties: {
      ...AGENT_ID_PROPERTY,
      product_id: { type: "string", description: "The ID of the product to disable" },
    },
    required: ["agent_id", "product_id"],
  },
};

const enableProduct: Tool = {
  name: "gumroad_enable_product",
  description: "Enables a product by its ID. Requires agent_id (must hold the 'listings' capability).",
  inputSchema: {
    type: "object",
    properties: {
      ...AGENT_ID_PROPERTY,
      product_id: { type: "string", description: "The ID of the product to enable" },
    },
    required: ["agent_id", "product_id"],
  },
};

const getOfferCodes: Tool = {
  name: "gumroad_get_offer_codes",
  description: "Retrieves all offer codes for a product",
  inputSchema: {
    type: "object",
    properties: {
      product_id: { type: "string", description: "The product ID to get offer codes for" },
    },
    required: ["product_id"],
  },
};

const getOfferCode: Tool = {
  name: "gumroad_get_offer_code",
  description: "Retrieves a single offer code by its ID for a specific product",
  inputSchema: {
    type: "object",
    properties: {
      product_id: { type: "string", description: "The product ID the offer code belongs to" },
      offer_code_id: { type: "string", description: "The ID of the offer code to retrieve" },
    },
    required: ["product_id", "offer_code_id"],
  },
};

const createOfferCode: Tool = {
  name: "gumroad_create_offer_code",
  description: "Creates a new offer code for a product. Requires agent_id (must hold the 'listings' capability).",
  inputSchema: {
    type: "object",
    properties: {
      ...AGENT_ID_PROPERTY,
      product_id: { type: "string", description: "The ID of the product this offer applies to" },
      name: { type: "string", description: "The name/code of the offer (coupon code used at checkout)" },
      amount_off: { type: "number", description: "The amount to discount" },
      offer_type: {
        type: "string",
        enum: ["cents", "percent"],
        description: "The type of offer (cents or percent). Default: cents",
      },
      max_purchase_count: { type: "number", description: "Maximum number of times this offer can be used" },
      universal: { type: "boolean", description: "Whether this offer applies to all products. Default: false" },
    },
    required: ["agent_id", "product_id", "name", "amount_off"],
  },
};

const updateOfferCode: Tool = {
  name: "gumroad_update_offer_code",
  description:
    "Updates the max purchase count of an existing offer code for a product. Requires agent_id " +
    "(must hold the 'listings' capability).",
  inputSchema: {
    type: "object",
    properties: {
      ...AGENT_ID_PROPERTY,
      product_id: { type: "string", description: "The ID of the product this offer applies to" },
      offer_code_id: { type: "string", description: "The ID of the offer code to update" },
      max_purchase_count: { type: "number", description: "Maximum number of times this offer can be used" },
    },
    required: ["agent_id", "product_id", "offer_code_id"],
  },
};

const deleteOfferCode: Tool = {
  name: "gumroad_delete_offer_code",
  description: "Deletes an offer code for a product. Requires agent_id (must hold the 'listings' capability).",
  inputSchema: {
    type: "object",
    properties: {
      ...AGENT_ID_PROPERTY,
      product_id: { type: "string", description: "The ID of the product this offer applies to" },
      offer_code_id: { type: "string", description: "The ID of the offer code to delete" },
    },
    required: ["agent_id", "product_id", "offer_code_id"],
  },
};

const updateProduct: Tool = {
  name: "gumroad_update_product",
  description: "Updates product metadata including tags, categories, price, summary, and published status. Requires agent_id (must hold the 'listings' capability).",
  inputSchema: {
    type: "object",
    properties: {
      ...AGENT_ID_PROPERTY,
      product_id: { type: "string", description: "The ID of the product to update" },
      name: { type: "string", description: "Product name" },
      description: { type: "string", description: "Product description" },
      price: { type: "number", description: "Product price in dollars" },
      tags: { type: "array", items: { type: "string" }, description: "Array of tags for the product" },
      categories: { type: "array", items: { type: "string" }, description: "Array of category IDs" },
      custom_summary: { type: "string", description: "Custom summary text displayed at checkout" },
      published: { type: "boolean", description: "Whether the product is published (true) or draft (false)" },
    },
    required: ["agent_id", "product_id"],
  },
};

// ---------------------------------------------------------------------------
// Product lifecycle (NAS Digital, 2026-08-20)
//
// Nathan: "agents report no create listing endpoint?" - they were right about
// this server and wrong about Gumroad. Upstream last shipped 2025-04-21 and
// only ever wrapped a read-mostly slice; Gumroad's own routes.rb carries
// :create and :destroy on products, plus covers, thumbnail and two upload
// flows, and a read-only probe of the live API confirmed the deployment has
// all of it.
//
// Reads stay UNGATED, matching the existing split - LEDGER holds `finance`,
// not `listings`, and gating the money reads would lock out the one agent
// whose job is reading them.
// ---------------------------------------------------------------------------

const createProduct: Tool = {
  name: "gumroad_create_product",
  description:
    "Creates a NEW Gumroad product. It is created as a DRAFT with purchases disabled - " +
    "Gumroad itself sets draft=true, so this cannot put anything on sale. Publishing is a " +
    "separate gumroad_enable_product call once Nathan has approved it. " +
    "NOTE price is in CENTS here (the API's own unit), unlike gumroad_update_product's " +
    "price which is in dollars. Physical products cannot be created through the API. " +
    "Requires agent_id (must hold the 'listings' capability).",
  inputSchema: {
    type: "object",
    properties: {
      ...AGENT_ID_PROPERTY,
      name: { type: "string", description: "Product name" },
      price: { type: "number", description: "Price in CENTS (e.g. 1200 for $12.00). 0 for pay-what-you-want" },
      description: { type: "string", description: "Product description (HTML allowed)" },
      native_type: {
        type: "string",
        enum: ["digital", "membership", "bundle", "ebook", "course", "coffee", "podcast", "audiobook", "physical_good_placeholder"],
        description: "Product type, default 'digital'. 'physical' is rejected by Gumroad for API creation",
      },
      price_currency_type: { type: "string", description: "ISO currency, e.g. 'usd' or 'gbp'. Defaults to the seller's currency" },
      custom_permalink: { type: "string", description: "The url slug, e.g. 'floating-islands'" },
      custom_summary: { type: "string", description: "Short summary shown at checkout" },
      tags: { type: "array", items: { type: "string" }, description: "Tags for discovery" },
      taxonomy_id: { type: "string", description: "Category id from gumroad_get_categories. Defaults to 'other'" },
      max_purchase_count: { type: "number", description: "Limit total sales (leave unset for unlimited)" },
      customizable_price: { type: "boolean", description: "Pay-what-you-want" },
      suggested_price_cents: { type: "number", description: "Suggested price for pay-what-you-want, in cents" },
      subscription_duration: {
        type: "string",
        description: "Membership billing period (monthly/quarterly/biannually/yearly). Only valid when native_type is 'membership'",
      },
      files: {
        type: "array",
        items: { type: "object" },
        description: "Files to sell, each { url } - get the url from gumroad_upload_product_file",
      },
    },
    required: ["agent_id", "name", "price"],
  },
};

const deleteProduct: Tool = {
  name: "gumroad_delete_product",
  description:
    "PERMANENTLY deletes a product. Not reversible. Prefer gumroad_disable_product, which takes " +
    "it off sale while keeping the listing and its sales history. Requires confirm_delete=true as " +
    "well as agent_id, so a mistyped product id cannot destroy a listing on its own. " +
    "Requires agent_id (must hold the 'listings' capability).",
  inputSchema: {
    type: "object",
    properties: {
      ...AGENT_ID_PROPERTY,
      product_id: { type: "string", description: "The product to delete" },
      confirm_delete: { type: "boolean", description: "Must be true. Deliberate friction on an irreversible action" },
    },
    required: ["agent_id", "product_id", "confirm_delete"],
  },
};

const uploadProductFile: Tool = {
  name: "gumroad_upload_product_file",
  description:
    "Uploads a LOCAL file for sale and returns its file_url, which you then pass in " +
    "gumroad_create_product's `files` array. This is the actual thing the buyer downloads. " +
    "Handles the multipart upload itself. Touches no product on its own. " +
    "Requires agent_id (must hold the 'listings' capability).",
  inputSchema: {
    type: "object",
    properties: {
      ...AGENT_ID_PROPERTY,
      file_path: { type: "string", description: "Absolute path to the local file" },
    },
    required: ["agent_id", "file_path"],
  },
};

const setProductCover: Tool = {
  name: "gumroad_set_product_cover",
  description:
    "Adds a cover image to a product's page - the large image buyers see. Give EITHER a local " +
    "file_path (uploaded for you) OR a publicly reachable url. Products can carry several covers; " +
    "this adds one. Requires agent_id (must hold the 'listings' capability).",
  inputSchema: {
    type: "object",
    properties: {
      ...AGENT_ID_PROPERTY,
      product_id: { type: "string", description: "The product to add a cover to" },
      file_path: { type: "string", description: "Absolute path to a local jpeg/png/gif" },
      url: { type: "string", description: "Alternatively, a publicly reachable image url" },
    },
    required: ["agent_id", "product_id"],
  },
};

const setProductThumbnail: Tool = {
  name: "gumroad_set_product_thumbnail",
  description:
    "Sets the product's thumbnail - the small image used in listings and search, so it must read " +
    "at a small size. Give EITHER a local file_path OR a public url. Replaces any existing " +
    "thumbnail. Requires agent_id (must hold the 'listings' capability).",
  inputSchema: {
    type: "object",
    properties: {
      ...AGENT_ID_PROPERTY,
      product_id: { type: "string", description: "The product to set a thumbnail on" },
      file_path: { type: "string", description: "Absolute path to a local jpeg/png/gif" },
      url: { type: "string", description: "Alternatively, a publicly reachable image url" },
    },
    required: ["agent_id", "product_id"],
  },
};

const getCategories: Tool = {
  name: "gumroad_get_categories",
  description:
    "Lists Gumroad's taxonomy categories and their ids. Call this to get a taxonomy_id before " +
    "creating a product - without one the product lands in 'other'. Read-only, no agent_id needed.",
  inputSchema: { type: "object", properties: {} },
};

const getSalesSummary: Tool = {
  name: "gumroad_get_sales_summary",
  description:
    "Totals rather than the sale-by-sale list gumroad_get_sales returns: gross, net, units and " +
    "refunds. Far cheaper than paging every sale to add them up. Read-only, no agent_id needed.",
  inputSchema: {
    type: "object",
    properties: {
      after: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Start date (YYYY-MM-DD)" },
      before: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "End date (YYYY-MM-DD)" },
    },
  },
};

const getPayouts: Tool = {
  name: "gumroad_get_payouts",
  description:
    "Gumroad's payouts to the seller - what has actually been paid out, as opposed to what has " +
    "been sold. Set upcoming=true for the next scheduled payout instead of the history. " +
    "Read-only, no agent_id needed.",
  inputSchema: {
    type: "object",
    properties: {
      upcoming: { type: "boolean", description: "Return the upcoming payout rather than past ones" },
    },
  },
};


// ---------------------------------------------------------------------------
// The rest of the API (NAS Digital, 2026-08-20). Nathan: "all of them, i want
// full control via api."
//
// Behind a catalogue + dispatcher rather than ~60 more registered tools, and
// the reason is measured rather than stylistic: every tool's schema is sent to
// every agent on every turn (no per-agent MCP scoping - openclaw#67682), so one
// tool per endpoint took this server from 12,515 to ~51,300 chars, which would
// have made Gumroad the fleet's second-largest MCP surface - larger than the
// fleet board itself - including for the eight agents that never touch it.
// etsy-mcp already solved this exact problem here: 105 operations, 5,332 chars.
//
// The 20 bespoke tools stay. They are the common path, agents already use them,
// and their descriptions carry the traps a generic dispatcher cannot state
// (create's price is in cents while update's is in dollars; create makes a
// draft, never a live listing).
// ---------------------------------------------------------------------------

const listOperations: Tool = {
  name: "gumroad_list_operations",
  description:
    "The full Gumroad API catalogue - every operation, its method, path, required path " +
    "parameters and the capability tier it sits in. Call this FIRST to find the operation " +
    "you need, then run it with gumroad_call. Filter with `tier` (read / financial / write / " +
    "destructive) or `search` (matches name and summary). Operations already covered by a " +
    "dedicated tool are marked `wrapped_by` - prefer that tool, its description carries " +
    "warnings this catalogue does not. Read-only, no agent_id needed.",
  inputSchema: {
    type: "object",
    properties: {
      tier: { type: "string", enum: ["read", "financial", "write", "destructive"], description: "Filter by tier" },
      search: { type: "string", description: "Match against operation name and summary, e.g. 'variant' or 'webhook'" },
    },
  },
};

const callOperation: Tool = {
  name: "gumroad_call",
  description:
    "Run any Gumroad API operation by name - the whole API, not just the tools listed here. " +
    "Find the name with gumroad_list_operations. Pass path parameters and body/query " +
    "parameters together in `params`; the dispatcher works out which is which from the " +
    "operation's path. Capability-gated by tier: reads are broad, writes need 'listings', " +
    "and the irreversible ones (deletes, refunds, sending mail to real customers) also need " +
    "confirm=true. Requires agent_id.",
  inputSchema: {
    type: "object",
    properties: {
      ...AGENT_ID_PROPERTY,
      operation: { type: "string", description: "Operation name from gumroad_list_operations, e.g. 'createVariant'" },
      params: { type: "object", description: "Path, query and body parameters together, e.g. { id: 'abc', name: 'Deluxe' }" },
      confirm: { type: "boolean", description: "Required for irreversible operations - deletes, refunds, sending a broadcast" },
    },
    required: ["agent_id", "operation"],
  },
};

export const createServer = (accessToken: string, baseUrl: string | undefined) => {
  const gumroadClient = new GumroadClient(accessToken, baseUrl);

  const server = new Server(
    {
      name: "Gumroad MCP Server",
      version: "0.0.7",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    console.error("Received CallToolRequest:", request);
    try {
      if (!request.params.arguments) {
        throw new Error("No arguments provided");
      }

      switch (request.params.name) {
        case "gumroad_get_user": {
          const response = await gumroadClient.getUser();
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }
        case "gumroad_get_products": {
          const response = await gumroadClient.getProducts();
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }
        case "gumroad_get_product": {
          const productId = request.params.arguments.product_id as string;
          const response = await gumroadClient.getProduct(productId);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }
        case "gumroad_disable_product": {
          await requireCapability(request.params.arguments.agent_id, REQUIRED_CAPABILITY);
          const productId = request.params.arguments.product_id as string;
          const response = await gumroadClient.disableProduct(productId);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }
        case "gumroad_enable_product": {
          await requireCapability(request.params.arguments.agent_id, REQUIRED_CAPABILITY);
          const productId = request.params.arguments.product_id as string;
          const response = await gumroadClient.enableProduct(productId);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }
        case "gumroad_list_operations": {
          const tier = request.params.arguments.tier as string | undefined;
          const search = (request.params.arguments.search as string | undefined)?.toLowerCase();
          const rows = OPERATIONS.filter((o) => {
            if (tier && o.tier !== tier) return false;
            if (search && !`${o.name} ${o.summary}`.toLowerCase().includes(search)) return false;
            return true;
          }).map((o) => ({
            operation: o.name,
            method: o.method,
            path: o.path,
            tier: o.tier,
            summary: o.summary,
            ...(o.pathParams.length ? { path_params: o.pathParams } : {}),
            ...(o.params ? { params: o.params } : {}),
            ...(o.wrappedBy ? { wrapped_by: o.wrappedBy } : {}),
            ...(CONFIRM_REQUIRED.has(o.name) ? { needs_confirm: true } : {}),
          }));
          return {
            content: [{ type: "text", text: JSON.stringify({ count: rows.length, operations: rows }) }],
          };
        }

        case "gumroad_call": {
          const args = {
            ...(request.params.arguments.params as Record<string, unknown> | undefined),
            agent_id: request.params.arguments.agent_id,
            confirm: request.params.arguments.confirm,
          };
          const response = await dispatch(
            `${(baseUrl || GumroadClient.BASE_URL).replace(/\/$/, "")}/v2`,
            { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            request.params.arguments.operation as string,
            args,
          );
          return { content: [{ type: "text", text: JSON.stringify(response) }] };
        }

        case "gumroad_create_product": {
          await requireCapability(request.params.arguments.agent_id, REQUIRED_CAPABILITY);
          const a = request.params.arguments;
          const params: Record<string, unknown> = {};
          for (const key of [
            "name", "price", "description", "native_type", "price_currency_type",
            "custom_permalink", "custom_summary", "tags", "taxonomy_id",
            "max_purchase_count", "customizable_price", "suggested_price_cents",
            "subscription_duration", "files",
          ]) {
            if (a[key] !== undefined) params[key] = a[key];
          }
          const response = await gumroadClient.createProduct(params);
          return { content: [{ type: "text", text: JSON.stringify(response) }] };
        }

        case "gumroad_delete_product": {
          await requireCapability(request.params.arguments.agent_id, REQUIRED_CAPABILITY);
          if (request.params.arguments.confirm_delete !== true) {
            // Deliberate friction: deletion is irreversible and disable_product
            // is almost always what was actually meant.
            return {
              content: [{
                type: "text",
                text: JSON.stringify({
                  success: false,
                  message:
                    "Refused: deleting a product is permanent. Pass confirm_delete=true if you " +
                    "really mean it, or use gumroad_disable_product to take it off sale while " +
                    "keeping the listing and its sales history.",
                }),
              }],
            };
          }
          const response = await gumroadClient.deleteProduct(request.params.arguments.product_id as string);
          return { content: [{ type: "text", text: JSON.stringify(response) }] };
        }

        case "gumroad_upload_product_file": {
          await requireCapability(request.params.arguments.agent_id, REQUIRED_CAPABILITY);
          const response = await gumroadClient.uploadProductFile(request.params.arguments.file_path as string);
          return { content: [{ type: "text", text: JSON.stringify(response) }] };
        }

        case "gumroad_set_product_cover":
        case "gumroad_set_product_thumbnail": {
          await requireCapability(request.params.arguments.agent_id, REQUIRED_CAPABILITY);
          const productId = request.params.arguments.product_id as string;
          const filePath = request.params.arguments.file_path as string | undefined;
          const url = request.params.arguments.url as string | undefined;
          if (!filePath && !url) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({ success: false, message: "Give either file_path (a local image) or url (a public one)." }),
              }],
            };
          }
          let body: Record<string, unknown>;
          if (filePath) {
            const uploaded = await gumroadClient.uploadImage(filePath);
            if (!uploaded.success || !uploaded.signed_blob_id) {
              return { content: [{ type: "text", text: JSON.stringify(uploaded) }] };
            }
            body = { signed_blob_id: uploaded.signed_blob_id };
          } else {
            body = { url };
          }
          const response = request.params.name === "gumroad_set_product_cover"
            ? await gumroadClient.addProductCover(productId, body)
            : await gumroadClient.setProductThumbnail(productId, body);
          return { content: [{ type: "text", text: JSON.stringify(response) }] };
        }

        case "gumroad_get_categories": {
          const response = await gumroadClient.getCategories();
          return { content: [{ type: "text", text: JSON.stringify(response) }] };
        }

        case "gumroad_get_sales_summary": {
          const params: Record<string, string> = {};
          if (request.params.arguments.after) params.after = request.params.arguments.after as string;
          if (request.params.arguments.before) params.before = request.params.arguments.before as string;
          const response = await gumroadClient.getSalesSummary(params);
          return { content: [{ type: "text", text: JSON.stringify(response) }] };
        }

        case "gumroad_get_payouts": {
          const response = await gumroadClient.getPayouts(request.params.arguments.upcoming === true);
          return { content: [{ type: "text", text: JSON.stringify(response) }] };
        }

        case "gumroad_update_product": {
          await requireCapability(request.params.arguments.agent_id, REQUIRED_CAPABILITY);
          const productId = request.params.arguments.product_id as string;
          const updateParams = {
            name: request.params.arguments.name,
            description: request.params.arguments.description,
            price: request.params.arguments.price,
            tags: request.params.arguments.tags,
            categories: request.params.arguments.categories,
            custom_summary: request.params.arguments.custom_summary,
            published: request.params.arguments.published,
          };
          // Remove undefined fields to avoid sending them to the API
          Object.keys(updateParams).forEach((key) => updateParams[key as keyof typeof updateParams] === undefined && delete updateParams[key as keyof typeof updateParams]);
          const response = await gumroadClient.updateProduct(productId, updateParams);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }
        case "gumroad_get_sales": {
          const response = await gumroadClient.getSales(request.params.arguments);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }
        case "gumroad_get_offer_codes": {
          const productId = request.params.arguments.product_id as string;
          const response = await gumroadClient.getOfferCodes(productId);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }
        case "gumroad_get_offer_code": {
          const productId = request.params.arguments.product_id as string;
          const offerCodeId = request.params.arguments.offer_code_id as string;
          const response = await gumroadClient.getOfferCode(productId, offerCodeId);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }
        case "gumroad_create_offer_code": {
          await requireCapability(request.params.arguments.agent_id, REQUIRED_CAPABILITY);
          // Type assertion to ensure type safety
          const productId = request.params.arguments.product_id as string;
          // Remove product_id and agent_id from arguments as they're not part of the Gumroad payload
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { product_id: _, agent_id: _a, ...params } = request.params.arguments as unknown as {
            product_id: string;
            agent_id: string;
            name: string;
            amount_off: number;
            offer_type?: "cents" | "percent";
            max_purchase_count?: number;
            universal?: boolean;
          };

          // Ensure amount_off is provided
          if (typeof params.amount_off !== "number") {
            throw new Error("amount_off is required and must be a number");
          }

          const response = await gumroadClient.createOfferCode(productId, params);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }
        case "gumroad_update_offer_code": {
          await requireCapability(request.params.arguments.agent_id, REQUIRED_CAPABILITY);
          const productId = request.params.arguments.product_id as string;
          const offerCodeId = request.params.arguments.offer_code_id as string;
          // Remove product_id, offer_code_id and agent_id from arguments as they're not part of the Gumroad payload
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { product_id: _p, offer_code_id: _o, agent_id: _a, ...updateParams } = request.params.arguments;
          const response = await gumroadClient.updateOfferCode(productId, offerCodeId, updateParams);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }
        case "gumroad_delete_offer_code": {
          await requireCapability(request.params.arguments.agent_id, REQUIRED_CAPABILITY);
          const productId = request.params.arguments.product_id as string;
          const offerCodeId = request.params.arguments.offer_code_id as string;
          const response = await gumroadClient.deleteOfferCode(productId, offerCodeId);
          return {
            content: [{ type: "text", text: JSON.stringify(response) }],
          };
        }
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    } catch (error) {
      console.error("Error executing tool:", error);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            }),
          },
        ],
      };
    }
  });

  server.setRequestHandler(ListToolsRequestSchema, () => {
    console.error("Received ListToolsRequest");
    return {
      tools: [
        getUser,
        getProduct,
        getProducts,
        getSales,
        getSalesSummary,
        getPayouts,
        listOperations,
        callOperation,
        getCategories,
        createProduct,
        deleteProduct,
        uploadProductFile,
        setProductCover,
        setProductThumbnail,
        disableProduct,
        enableProduct,
        updateProduct,
        getOfferCodes,
        getOfferCode,
        createOfferCode,
        updateOfferCode,
        deleteOfferCode,
      ],
    };
  });

  return { server, cleanup: () => server.close() };
};
