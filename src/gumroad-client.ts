interface Product {
  id: string;
  name: string;
  preview_url: string | null;
  description: string;
  custom_permalink: string | null;
  custom_receipt: string | null;
  custom_summary: string;
  custom_fields: Record<string, string>[];
  customizable_price: number | null;
  require_shipping: boolean;
  custom_fields_enabled: boolean;
  subscription_duration: string | null;
  published: boolean;
  url: string;
  price: number;
  currency: string;
  short_url: string;
  thumbnail_url: string;
  sales_count?: string;
  sales_usd_cents?: string;
  tags: string[];
}

interface GumroadUser {
  bio: string;
  name: string;
  twitter_handle: string | null;
  user_id: string;
  email?: string;
  url?: string;
}

interface Sale {
  id: string;
  email: string;
  seller_id: string;
  timestamp: string;
  daystamp: string;
  created_at: string;
  product_name: string;
  product_has_variants: boolean;
  price: number;
  gumroad_fee: number;
  subscription_duration: string | null;
  currency_symbol: string;
  product_id: string;
  product_permalink: string;
  purchase_email: string;
  order_id: number;
  sale_id: string;
  variants?: Record<string, string>;
  license_key?: string;
}

interface OfferCode {
  id: string;
  name: string;
  amount_cents: number;
  offer_type: string;
  max_purchase_count: number;
  universal: boolean;
  product_id?: string;
  resource_id?: string;
  created_at: string;
  updated_at: string;
  expires_at?: string | null;
  claims_count?: number;
}

interface CreateOfferCodeArgs {
  name: string;
  amount_off: number;
  offer_type?: "cents" | "percent";
  max_purchase_count?: number;
  universal?: boolean;
}

interface UpdateOfferCodeArgs {
  max_purchase_count?: number;
}

interface UpdateProductArgs {
  name?: string;
  description?: string;
  price?: number;
  tags?: string[];
  categories?: string[];
  custom_summary?: string;
  published?: boolean;
}

interface GumroadResponse<T> {
  success: boolean;
  next_page_key?: string;
  next_page_url?: string;
  products?: T[];
  sales?: T[];
  offer_codes?: T[];
}

// Endpoints added 2026-08-20 whose payloads are not modelled field by field.
// Deliberately loose rather than a guessed-at interface: an interface that
// claims fields the API does not return is worse than an honest bag, and these
// are passed straight through to the caller as JSON anyway.
type GumroadApiResult = Record<string, unknown> & { success?: boolean; message?: string };

interface GetSalesArgs {
  after?: string;
  before?: string;
  product_id?: string;
  email?: string;
  order_id?: string;
  page_key?: string;
}

export class GumroadClient {
  public static readonly BASE_URL = "https://api.gumroad.com";

  private headers: { Authorization: string; "Content-Type": string };
  private apiUrl: string;

  constructor(accessToken: string, baseUrl: string | undefined) {
    this.headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
    let url = baseUrl || GumroadClient.BASE_URL;
    url = url.replace(/\/$/, "");
    if (url !== GumroadClient.BASE_URL) {
      // Disable certificate verification for non-production environments (e.g. for gumroad.dev)
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }
    this.apiUrl = `${url}/v2`;
    console.error("Gumroad client initialized with base URL:", this.apiUrl);
  }

  async getUser(): Promise<{ success: boolean; user?: GumroadUser; message?: string }> {
    const url = `${this.apiUrl}/user`;
    console.error("Making request to:", url);
    const response = await fetch(url, { headers: this.headers });
    return response.json();
  }

  async getProduct(productId: string): Promise<{ success: boolean; product?: Product; message?: string }> {
    const url = `${this.apiUrl}/products/${productId}`;
    console.error("Making request to:", url);
    const response = await fetch(url, { headers: this.headers });
    return response.json();
  }

  async getProducts(): Promise<GumroadResponse<Product>> {
    const response = await fetch(`${this.apiUrl}/products`, {
      headers: this.headers,
    });

    return response.json();
  }

  async getSales(params?: GetSalesArgs): Promise<GumroadResponse<Sale>> {
    const queryParams = new URLSearchParams();

    if (params?.after) queryParams.append("after", params.after);
    if (params?.before) queryParams.append("before", params.before);
    if (params?.product_id) queryParams.append("product_id", params.product_id);
    if (params?.email) queryParams.append("email", params.email);
    if (params?.order_id) queryParams.append("order_id", params.order_id);
    if (params?.page_key) queryParams.append("page_key", params.page_key);

    const url = `${this.apiUrl}/sales${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    console.error("Making request to:", url);

    const response = await fetch(url, { headers: this.headers });
    return response.json();
  }

  async disableProduct(productId: string): Promise<{ success: boolean; product?: Product; message?: string }> {
    const url = `${this.apiUrl}/products/${productId}/disable`;
    console.error("Making request to:", url);
    const response = await fetch(url, {
      headers: this.headers,
      method: "PUT",
    });
    return response.json();
  }

  async enableProduct(productId: string): Promise<{ success: boolean; product?: Product; message?: string }> {
    const url = `${this.apiUrl}/products/${productId}/enable`;
    console.error("Making request to:", url);
    const response = await fetch(url, {
      headers: this.headers,
      method: "PUT",
    });
    return response.json();
  }

  async getOfferCodes(productId: string): Promise<GumroadResponse<OfferCode>> {
    const url = `${this.apiUrl}/products/${productId}/offer_codes`;
    console.error("Making request to:", url);
    const response = await fetch(url, { headers: this.headers });
    return response.json();
  }

  async getOfferCode(
    productId: string,
    offerCodeId: string,
  ): Promise<{ success: boolean; offer_code?: OfferCode; message?: string }> {
    const url = `${this.apiUrl}/products/${productId}/offer_codes/${offerCodeId}`;
    console.error("Making request to:", url);
    const response = await fetch(url, { headers: this.headers });
    return response.json();
  }

  async createOfferCode(
    productId: string,
    params: CreateOfferCodeArgs,
  ): Promise<{ success: boolean; offer_code?: OfferCode; message?: string }> {
    const url = `${this.apiUrl}/products/${productId}/offer_codes`;
    console.error("Making request to:", url);

    const response = await fetch(url, {
      body: JSON.stringify(params),
      headers: this.headers,
      method: "POST",
    });
    return response.json();
  }

  async updateOfferCode(
    productId: string,
    offerCodeId: string,
    params: UpdateOfferCodeArgs,
  ): Promise<{ success: boolean; offer_code?: OfferCode; message?: string }> {
    const url = `${this.apiUrl}/products/${productId}/offer_codes/${offerCodeId}`;
    console.error("Making request to:", url);

    const response = await fetch(url, {
      body: JSON.stringify(params),
      headers: this.headers,
      method: "PUT",
    });
    return response.json();
  }

  async deleteOfferCode(productId: string, offerCodeId: string): Promise<{ success: boolean; message?: string }> {
    const url = `${this.apiUrl}/products/${productId}/offer_codes/${offerCodeId}`;
    console.error("Making request to:", url);

    const response = await fetch(url, {
      headers: this.headers,
      method: "DELETE",
    });
    return response.json();
  }

  async updateProduct(
    productId: string,
    params: UpdateProductArgs,
  ): Promise<{ success: boolean; product?: Product; message?: string }> {
    const url = `${this.apiUrl}/products/${productId}`;
    console.error("Making request to:", url);

    const response = await fetch(url, {
      body: JSON.stringify(params),
      headers: this.headers,
      method: "PUT",
    });
    return response.json();
  }

  // ---------------------------------------------------------------------
  // Product lifecycle (NAS Digital, 2026-08-20)
  //
  // Upstream rmarescu/gumroad-mcp last shipped 2025-04-21 and never wrapped
  // these, so agents reported "no create listing endpoint" and concluded
  // Gumroad could not do it. Gumroad's own config/routes.rb says otherwise -
  // `resources :links, path: "products", only: [..., :create, :destroy]` -
  // and a read-only probe of the live API returned 200 across the whole
  // current surface, so the deployment carries it.
  // ---------------------------------------------------------------------

  /**
   * Create a product. It is created as a DRAFT with purchases disabled -
   * Gumroad's own controller sets `draft = true` and `purchase_disabled_at`,
   * so this cannot put anything on sale by itself. Publishing is a separate
   * enableProduct call, which is the right shape for a HITL fleet.
   *
   * Physical and legacy product types are rejected by Gumroad for creation;
   * native_type defaults to "digital".
   *
   * `price` is in CENTS here, matching the API, even though updateProduct's
   * existing `price` is in dollars - that asymmetry is upstream's and is
   * called out in the tool description rather than silently normalised,
   * because guessing wrong about someone's price is expensive.
   */
  async createProduct(params: Record<string, unknown>): Promise<GumroadApiResult> {
    const url = `${this.apiUrl}/products`;
    console.error("Making request to:", url);
    const response = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(params),
    });
    return response.json();
  }

  async deleteProduct(productId: string): Promise<GumroadApiResult> {
    const url = `${this.apiUrl}/products/${productId}`;
    console.error("Making request to:", url);
    const response = await fetch(url, { method: "DELETE", headers: this.headers });
    return response.json();
  }

  /** A cover image on the product page. Accepts a public url or a signed_blob_id. */
  async addProductCover(productId: string, body: Record<string, unknown>): Promise<GumroadApiResult> {
    const url = `${this.apiUrl}/products/${productId}/covers`;
    console.error("Making request to:", url);
    const response = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });
    return response.json();
  }

  /** The small thumbnail used in listings and search. Same two input shapes. */
  async setProductThumbnail(productId: string, body: Record<string, unknown>): Promise<GumroadApiResult> {
    const url = `${this.apiUrl}/products/${productId}/thumbnail`;
    console.error("Making request to:", url);
    const response = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });
    return response.json();
  }

  /** Taxonomy categories - you need one of these ids for a product's taxonomy_id. */
  async getCategories(): Promise<GumroadApiResult> {
    const response = await fetch(`${this.apiUrl}/categories`, { headers: this.headers });
    return response.json();
  }

  /** Totals rather than the sale-by-sale list getSales returns. */
  async getSalesSummary(params?: Record<string, string>): Promise<GumroadApiResult> {
    const qs = new URLSearchParams(params || {}).toString();
    const url = `${this.apiUrl}/sales/summary${qs ? `?${qs}` : ""}`;
    console.error("Making request to:", url);
    const response = await fetch(url, { headers: this.headers });
    return response.json();
  }

  async getPayouts(upcoming = false): Promise<GumroadApiResult> {
    const url = `${this.apiUrl}/payouts${upcoming ? "/upcoming" : ""}`;
    console.error("Making request to:", url);
    const response = await fetch(url, { headers: this.headers });
    return response.json();
  }

  // ---------------------------------------------------------------------
  // Uploads. Two entirely separate mechanisms, because Gumroad treats an
  // IMAGE and a SELLABLE FILE differently:
  //
  //   images -> POST /v2/direct_uploads reserves an ActiveStorage blob, the
  //             bytes go straight to storage, and the returned signed_id is
  //             what covers/thumbnail accept.
  //   files  -> POST /v2/files/presign returns presigned S3 multipart URLs,
  //             the bytes go to S3 part by part, and /v2/files/complete
  //             assembles them into the file_url a product's `files` takes.
  //
  // Neither touches a product, so both are safe to exercise on their own.
  // ---------------------------------------------------------------------

  /** Upload a local image and return the signed_blob_id covers/thumbnail want. */
  async uploadImage(filePath: string, purpose?: "media"): Promise<{ signed_blob_id?: string; message?: string; success: boolean }> {
    const { readFile } = await import("node:fs/promises");
    const { createHash } = await import("node:crypto");
    const { basename, extname } = await import("node:path");

    const bytes = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    const contentType = ext === ".png" ? "image/png"
      : ext === ".gif" ? "image/gif"
      : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
      : "";
    if (!contentType) {
      return { success: false, message: `Unsupported image type "${ext}" - Gumroad accepts jpeg, png and gif.` };
    }
    // ActiveStorage wants a base64 MD5, not a hex digest.
    const checksum = createHash("md5").update(bytes).digest("base64");

    const reserveUrl = `${this.apiUrl}/direct_uploads`;
    console.error("Making request to:", reserveUrl);
    const reserveRes = await fetch(reserveUrl, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        blob: { filename: basename(filePath), byte_size: bytes.byteLength, checksum, content_type: contentType },
        ...(purpose ? { purpose } : {}),
      }),
    });
    const reserved = (await reserveRes.json()) as {
      signed_id?: string;
      direct_upload?: { url: string; headers: Record<string, string> };
      message?: string;
    };
    if (!reserved.signed_id || !reserved.direct_upload) {
      return { success: false, message: reserved.message || "Gumroad did not return a direct upload reservation." };
    }

    const put = await fetch(reserved.direct_upload.url, {
      method: "PUT",
      headers: reserved.direct_upload.headers,
      body: new Uint8Array(bytes),
    });
    if (!put.ok) {
      return { success: false, message: `Upload failed (${put.status}) - the reservation was made but the bytes did not land.` };
    }
    return { success: true, signed_blob_id: reserved.signed_id };
  }

  /**
   * Upload a local file for sale and return its file_url.
   *
   * Multipart: /files/presign hands back one presigned URL per 100 MB part,
   * each part is PUT directly to S3, and /files/complete needs every part's
   * ETag back in order. A failure part-way leaves an incomplete multipart
   * upload, so it is aborted rather than left to linger.
   */
  async uploadProductFile(filePath: string): Promise<{ file_url?: string; message?: string; success: boolean }> {
    const { readFile } = await import("node:fs/promises");
    const { basename } = await import("node:path");

    const bytes = await readFile(filePath);
    const presignUrl = `${this.apiUrl}/files/presign`;
    console.error("Making request to:", presignUrl);
    const presignRes = await fetch(presignUrl, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ filename: basename(filePath), file_size: bytes.byteLength }),
    });
    const presigned = (await presignRes.json()) as {
      success?: boolean;
      upload_id?: string;
      key?: string;
      file_url?: string;
      parts?: { part_number: number; presigned_url: string }[];
      message?: string;
    };
    if (!presigned.success || !presigned.parts || !presigned.upload_id || !presigned.key) {
      return { success: false, message: presigned.message || "Gumroad did not return a presigned upload." };
    }

    const PART_SIZE = 100 * 1024 * 1024;
    const completed: { part_number: number; etag: string }[] = [];
    try {
      for (const part of presigned.parts) {
        const start = (part.part_number - 1) * PART_SIZE;
        const chunk = bytes.subarray(start, Math.min(start + PART_SIZE, bytes.byteLength));
        const put = await fetch(part.presigned_url, { method: "PUT", body: new Uint8Array(chunk) });
        if (!put.ok) throw new Error(`part ${part.part_number} failed with ${put.status}`);
        const etag = put.headers.get("etag");
        if (!etag) throw new Error(`part ${part.part_number} returned no ETag`);
        completed.push({ part_number: part.part_number, etag });
      }
    } catch (err) {
      // Leave no half-finished multipart upload behind.
      await fetch(`${this.apiUrl}/files/abort`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ upload_id: presigned.upload_id, key: presigned.key }),
      }).catch(() => undefined);
      return { success: false, message: `Upload aborted: ${err instanceof Error ? err.message : String(err)}` };
    }

    const completeRes = await fetch(`${this.apiUrl}/files/complete`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ upload_id: presigned.upload_id, key: presigned.key, parts: completed }),
    });
    const done = (await completeRes.json()) as { success?: boolean; file_url?: string; message?: string };
    if (!done.success || !done.file_url) {
      return { success: false, message: done.message || "Gumroad did not confirm the completed upload." };
    }
    return { success: true, file_url: done.file_url };
  }
}
