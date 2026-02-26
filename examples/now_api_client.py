"""
NOW System – External API Client Example (Python)

Usage:
    1. Generate an API key from your NOW dashboard (Settings → API Keys)
    2. Set environment variables:
         export NOW_BASE_URL="http://localhost:3000"
         export NOW_API_KEY="nw_live_sk_YOUR_KEY_HERE"
    3. Run: python examples/now_api_client.py

Requirements: pip install requests
"""

import os
import json
import requests
from typing import Optional, Dict, Any, List

BASE_URL = os.environ.get("NOW_BASE_URL", "http://localhost:3000")
API_KEY = os.environ.get("NOW_API_KEY", "nw_live_sk_YOUR_KEY_HERE")

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}


def api_get(path: str, params: Optional[Dict] = None) -> Dict:
    """Make a GET request to the NOW API."""
    res = requests.get(f"{BASE_URL}/api/v1{path}", headers=HEADERS, params=params)
    body = res.json()
    if not res.ok:
        raise Exception(f"API Error {res.status_code}: {body.get('error', {}).get('message', body)}")
    return body


def api_post(path: str, data: Dict) -> Dict:
    """Make a POST request to the NOW API."""
    res = requests.post(f"{BASE_URL}/api/v1{path}", headers=HEADERS, json=data)
    body = res.json()
    if not res.ok:
        raise Exception(f"API Error {res.status_code}: {body.get('error', {}).get('message', body)}")
    return body


# ─── Organizations ─────────────────────────────────────────────────────────

def create_organization(
    name: str,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    industry: Optional[str] = None,
    company_size: Optional[str] = None,
    tax_id: Optional[str] = None,
    status: str = "PROSPECT",
    custom_fields: Optional[Dict] = None,
) -> Dict:
    payload = {
        "name": name,
        "email": email,
        "phone": phone,
        "industry": industry,
        "company_size": company_size,
        "tax_id": tax_id,
        "status": status,
        "custom_fields": custom_fields or {},
    }
    result = api_post("/organizations", payload)
    print(f"✅ Created organization: {result['data']}")
    return result["data"]


def list_organizations(page: int = 1, page_size: int = 50, search: str = "") -> Dict:
    params = {"page": page, "pageSize": page_size}
    if search:
        params["search"] = search
    result = api_get("/organizations", params=params)
    print(f"📋 Organizations: {result['meta']['total']} total, showing {len(result['data'])}")
    return result


def get_organization(org_id: str) -> Dict:
    result = api_get(f"/organizations/{org_id}")
    return result["data"]


# ─── People ────────────────────────────────────────────────────────────────

def create_person(
    first_name: str,
    last_name: str,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    status: str = "LEAD",
    tags: Optional[List[str]] = None,
    custom_fields: Optional[Dict] = None,
) -> Dict:
    payload = {
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "phone": phone,
        "status": status,
        "tags": tags or [],
        "custom_fields": custom_fields or {},
    }
    result = api_post("/people", payload)
    print(f"✅ Created person: {result['data']}")
    return result["data"]


def list_people(page: int = 1, page_size: int = 50, search: str = "") -> Dict:
    params = {"page": page, "pageSize": page_size}
    if search:
        params["search"] = search
    result = api_get("/people", params=params)
    print(f"📋 People: {result['meta']['total']} total, showing {len(result['data'])}")
    return result


def get_person(person_id: str) -> Dict:
    result = api_get(f"/people/{person_id}")
    return result["data"]


# ─── Relationships ─────────────────────────────────────────────────────────

def create_relationship(
    source_id: str,
    target_id: str,
    relationship_type: str,
    metadata: Optional[Dict] = None,
) -> Dict:
    """
    Create a relationship between two entities.
    relationship_type: e.g. "Employee", "Supplier", "Partner"
    metadata: arbitrary dict, e.g. {"job_title": "CEO", "start_date": "2024-01-01"}
    """
    payload = {
        "source_id": source_id,
        "target_id": target_id,
        "relationship_type": relationship_type,
        "metadata": metadata or {},
    }
    result = api_post("/relationships", payload)
    print(f"✅ Created relationship: {result['data']}")
    return result["data"]


def list_relationships(page: int = 1, page_size: int = 50) -> Dict:
    result = api_get("/relationships", params={"page": page, "pageSize": page_size})
    print(f"📋 Relationships: {result['meta']['total']} total")
    return result


# ─── Schema (Custom Fields) ────────────────────────────────────────────────

def get_schema() -> Dict:
    """Get custom field definitions for all entity types."""
    result = api_get("/schema")
    print("📐 Schema:")
    print(json.dumps(result["data"], indent=2, ensure_ascii=False))
    return result["data"]


# ─── Full Demo ─────────────────────────────────────────────────────────────

def main():
    print("🚀 NOW API Client Demo (Python)\n")

    # 1. Check custom field schema
    schema = get_schema()
    print()

    # 2. Create an organization
    org = create_organization(
        name="Acme Corporation",
        email="contact@acme.com",
        phone="+972-3-1234567",
        industry="Technology",
        company_size="51-200",
        status="PROSPECT",
        custom_fields={"linkedin_url": "https://linkedin.com/company/acme"},
    )

    # 3. Create a person
    person = create_person(
        first_name="ישראל",
        last_name="ישראלי",
        email="israel@acme.com",
        phone="+972-50-9876543",
        status="LEAD",
        tags=["vip", "enterprise"],
        custom_fields={"lead_score": 85},
    )

    # 4. Link them with a relationship
    rel = create_relationship(
        source_id=org["id"],
        target_id=person["id"],
        relationship_type="Employee",
        metadata={"job_title": "CEO", "start_date": "2024-01-01"},
    )

    # 5. List with search
    list_organizations(search="Acme")
    list_people(page_size=10)
    list_relationships()

    print("\n✅ Demo complete!")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"❌ Error: {e}")
        exit(1)
