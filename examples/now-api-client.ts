/**
 * NOW System – External API Client Example (TypeScript / Node.js)
 *
 * Usage:
 *   1. Generate an API key from your NOW dashboard (Settings → API Keys)
 *      or call POST /api/v1/keys while logged in.
 *   2. Set the env variables below.
 *   3. Run: npx tsx examples/now-api-client.ts
 */

const BASE_URL = process.env.NOW_BASE_URL ?? "http://localhost:3000";
const API_KEY = process.env.NOW_API_KEY ?? "nw_live_sk_YOUR_KEY_HERE";

// ─── Generic fetch helper ──────────────────────────────────────────────────

async function apiFetch(
    path: string,
    options: RequestInit = {}
): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/v1${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
            ...(options.headers ?? {}),
        },
    });

    const body = await res.json();

    if (!res.ok) {
        throw new Error(
            `API Error ${res.status}: ${body?.error?.message ?? JSON.stringify(body)}`
        );
    }

    return body;
}

// ─── Organizations ─────────────────────────────────────────────────────────

async function createOrganization(params: {
    name: string;
    email?: string;
    phone?: string;
    industry?: string;
    company_size?: string;
    tax_id?: string;
    status?: string;
    custom_fields?: Record<string, any>;
}) {
    const result = await apiFetch("/organizations", {
        method: "POST",
        body: JSON.stringify(params),
    });
    console.log("✅ Created organization:", result.data);
    return result.data;
}

async function listOrganizations(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
}) {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params?.search) qs.set("search", params.search);

    const result = await apiFetch(`/organizations?${qs}`);
    console.log(`📋 Organizations: ${result.meta.total} total, showing ${result.data.length}`);
    return result;
}

async function getOrganization(id: string) {
    const result = await apiFetch(`/organizations/${id}`);
    return result.data;
}

// ─── People ────────────────────────────────────────────────────────────────

async function createPerson(params: {
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    status?: string;
    tags?: string[];
    custom_fields?: Record<string, any>;
}) {
    const result = await apiFetch("/people", {
        method: "POST",
        body: JSON.stringify(params),
    });
    console.log("✅ Created person:", result.data);
    return result.data;
}

async function listPeople(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
}) {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params?.search) qs.set("search", params.search);

    const result = await apiFetch(`/people?${qs}`);
    console.log(`📋 People: ${result.meta.total} total, showing ${result.data.length}`);
    return result;
}

async function getPerson(id: string) {
    const result = await apiFetch(`/people/${id}`);
    return result.data;
}

// ─── Relationships ─────────────────────────────────────────────────────────

async function createRelationship(params: {
    source_id: string;
    target_id: string;
    relationship_type: string; // e.g. "Employee", "Supplier", "Partner"
    metadata?: Record<string, any>;
}) {
    const result = await apiFetch("/relationships", {
        method: "POST",
        body: JSON.stringify(params),
    });
    console.log("✅ Created relationship:", result.data);
    return result.data;
}

async function listRelationships(params?: {
    page?: number;
    pageSize?: number;
}) {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));

    const result = await apiFetch(`/relationships?${qs}`);
    console.log(`📋 Relationships: ${result.meta.total} total`);
    return result;
}

// ─── Schema (Custom Fields) ────────────────────────────────────────────────

async function getSchema() {
    const result = await apiFetch("/schema");
    console.log("📐 Schema:", JSON.stringify(result.data, null, 2));
    return result.data;
}

// ─── Full Demo ─────────────────────────────────────────────────────────────

async function main() {
    console.log("🚀 NOW API Client Demo\n");

    // 1. Check custom field schema
    const schema = await getSchema();

    // 2. Create an organization
    const org = await createOrganization({
        name: "Acme Corporation",
        email: "contact@acme.com",
        phone: "+972-3-1234567",
        industry: "Technology",
        company_size: "51-200",
        status: "PROSPECT",
        custom_fields: {
            // Use keys from schema.organizations
            linkedin_url: "https://linkedin.com/company/acme",
        },
    });

    // 3. Create a person
    const person = await createPerson({
        first_name: "ישראל",
        last_name: "ישראלי",
        email: "israel@acme.com",
        phone: "+972-50-9876543",
        status: "LEAD",
        tags: ["vip", "enterprise"],
        custom_fields: {
            lead_score: 85,
        },
    });

    // 4. Link them with a relationship
    const rel = await createRelationship({
        source_id: org.id,
        target_id: person.id,
        relationship_type: "Employee",
        metadata: {
            job_title: "CEO",
            start_date: "2024-01-01",
        },
    });

    // 5. List everything
    await listOrganizations({ pageSize: 5 });
    await listPeople({ pageSize: 5 });
    await listRelationships({ pageSize: 5 });

    console.log("\n✅ Demo complete!");
}

main().catch((err) => {
    console.error("❌ Error:", err.message);
    process.exit(1);
});
