import { OPERATIONS_BY_NAME, type GumroadOperation, type OperationTier } from "./operations.js";
import { requireCapability } from "./agent-capability.js";

/**
 * Which fleet-board capability a caller must hold for each tier.
 *
 * The same policy shape etsy-mcp uses, and for the same reason: read broadly,
 * change narrowly. A read cannot damage the store, so withholding one only
 * produces an agent that reports a gap it could have looked up. A write can.
 *
 * Capability holders (GET /agents/<id>/capabilities):
 *   echo -> social, listings, customer_relations | ledger -> finance
 *   nexus -> orchestration, planning, security_monitoring
 */
export const TIER_CAPABILITIES: Record<OperationTier, string[]> = {
  // Catalogue, storefront and product structure. Broad on purpose.
  read: ["listings", "finance", "orchestration", "content", "social", "research"],

  // Money: sales, payouts, earnings, tax forms, subscribers. LEDGER's whole job
  // is revenue reporting and it holds `finance`, not `listings` - gating this to
  // listings would lock out the one agent that exists to read it.
  financial: ["listings", "finance", "orchestration"],

  // Anything that changes the live store. ECHO only: `listings` is uniquely its
  // capability, which is what makes it the write gate.
  write: ["listings"],

  // Deletes, refunds and sending mail to real customers. Same capability as
  // write deliberately - the extra protection is the required confirm flag
  // below, not a different capability, because an agent allowed to edit but
  // never delete cannot maintain a listing at all (replacing a cover image IS
  // a delete). What separates these is that they cannot be undone.
  destructive: ["listings"],
};

/**
 * Operations that need `confirm: true` on top of the capability check.
 *
 * Not every destructive op is equally alarming, but every one of these either
 * destroys something with no undo, moves real money, or reaches real customers.
 * The friction is deliberate: a mistyped id should not be able to do any of it
 * on its own.
 */
export const CONFIRM_REQUIRED = new Set([
  "deleteProduct", "deletePage", "deleteMedia", "deleteUpsell", "deleteUtmLink",
  "deleteEmail", "deleteWebhook", "deleteVariantCategory", "deleteVariant",
  "deleteCustomField", "deleteOfferCode", "deleteProductCover", "deleteProductThumbnail",
  "refundSale", "sendEmail", "scheduleEmail",
]);

function isSet(v: unknown): boolean {
  return v !== undefined && v !== null && v !== "";
}

/** Substitutes {placeholders}; refuses rather than sending a literal "{id}". */
export function buildPath(op: GumroadOperation, args: Record<string, unknown>): string {
  let out = op.path;
  for (const name of op.pathParams) {
    const v = args[name];
    if (!isSet(v)) {
      throw new Error(`${op.name} requires the path parameter "${name}".`);
    }
    out = out.replace(`{${name}}`, encodeURIComponent(String(v)));
  }
  const leftover = out.match(/\{([^}]+)\}/);
  if (leftover) throw new Error(`${op.name}: unresolved path parameter "${leftover[1]}".`);
  return out;
}

/**
 * One dispatcher for the whole API, driven by the operations table.
 *
 * The alternative - a hand-written handler per endpoint - is one chance per
 * endpoint to transpose a path segment or send a query param as a body field,
 * and those surface as a confusing Gumroad 400 rather than a crash. This repo's
 * sibling carried exactly that for weeks: printify-mcp's updateProduct sent
 * camelCase where the API wanted snake_case, so every variant update had been
 * broken since the fork while creation worked fine.
 */
export async function dispatch(
  apiUrl: string,
  headers: Record<string, string>,
  operationName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const op = OPERATIONS_BY_NAME.get(operationName);
  if (!op) {
    throw new Error(
      `Unknown operation "${operationName}". Call gumroad_list_operations to see what exists.`,
    );
  }

  await requireCapability(args.agent_id, TIER_CAPABILITIES[op.tier]);

  if (CONFIRM_REQUIRED.has(op.name) && args.confirm !== true) {
    return {
      success: false,
      message:
        `Refused: "${op.name}" ${op.summary.toLowerCase().includes("refund")
          ? "moves real money and cannot be undone"
          : op.summary.toLowerCase().includes("send")
            ? "reaches real customers and cannot be recalled"
            : "cannot be undone"}. Pass confirm=true if you really mean it.`,
    };
  }

  const path = buildPath(op, args);
  // Only send what the caller actually set. Gumroad rejects a malformed value
  // outright rather than ignoring it, so passing every known key through as
  // undefined would fail the whole request.
  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (k === "agent_id" || k === "confirm" || op.pathParams.includes(k)) continue;
    if (isSet(v)) rest[k] = v;
  }

  let url = `${apiUrl}${path}`;
  const init: RequestInit = { method: op.method, headers };
  if (op.method === "GET" || op.method === "DELETE") {
    const qs = new URLSearchParams(
      Object.entries(rest).map(([k, v]) => [k, String(v)]),
    ).toString();
    if (qs) url += `?${qs}`;
  } else {
    init.body = JSON.stringify(rest);
  }

  console.error(`Dispatching ${op.method} ${path}`);
  const res = await fetch(url, init);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // Gumroad answers a bad path with an HTML error page, which as a raw parse
    // failure reads like a broken tool rather than a wrong id.
    return {
      success: false,
      status: res.status,
      message: `Gumroad returned ${res.status} and a non-JSON body for ${op.method} ${path} - usually a wrong id in the path.`,
    };
  }
}
