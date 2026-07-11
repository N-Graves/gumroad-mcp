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
