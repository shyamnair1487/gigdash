"""
GigDash Lead Scraper
────────────────────
Scrapes businesses from Google Maps via Outscraper API,
enriches with emails via Hunter.io, then pushes to Supabase.

Setup:
  pip install requests python-dotenv

Config:
  Copy .env.example to .env and fill in your keys.

Usage:
  python scraper.py --query "e-commerce company" --market MY --limit 50
  python scraper.py --query "accounting firm" --market SG --limit 30
  python scraper.py --query "retail store kuala lumpur" --market MY --industry Retail --limit 100
"""

import argparse
import os
import time
import json
import re
import logging
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv

try:
    from email_finder import find_email_from_website
    HAS_EMAIL_FINDER = True
except ImportError:
    HAS_EMAIL_FINDER = False

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)s  %(message)s")
log = logging.getLogger("gigdash")

# ── Keys (set in .env) ────────────────────────────────────────────────────────
OUTSCRAPER_KEY  = os.getenv("OUTSCRAPER_KEY", "")   # https://outscraper.com
HUNTER_KEY      = os.getenv("HUNTER_KEY", "")       # https://hunter.io  (free: 25/mo)
SUPABASE_URL    = os.getenv("SUPABASE_URL", "")     # https://YOUR.supabase.co
SUPABASE_KEY    = os.getenv("SUPABASE_KEY", "")     # service_role key (not anon)
BREVO_KEY       = os.getenv("BREVO_API_KEY", "")    # https://brevo.com

# ── Market config ─────────────────────────────────────────────────────────────
MARKET_CITY = {
    "MY": ["Kuala Lumpur", "Petaling Jaya", "Shah Alam", "Johor Bahru", "Penang"],
    "SG": ["Singapore"],
    "UK": ["London", "Manchester", "Birmingham"],
    "US": ["New York", "San Francisco", "Austin"],
}

PHONE_PATTERNS = {
    "MY": r"\+?6?0[1-9][0-9]{7,9}",
    "SG": r"\+?65[689][0-9]{7}",
    "UK": r"\+?44[0-9]{10}",
    "US": r"\+?1?[2-9][0-9]{9}",
}


# ── Outscraper: Google Maps ───────────────────────────────────────────────────
def scrape_google_maps(query: str, market: str, limit: int = 50) -> list[dict]:
    """
    Returns a list of raw business dicts from Outscraper.
    Docs: https://outscraper.com/google-maps-scraper/
    """
    if not OUTSCRAPER_KEY:
        log.warning("No OUTSCRAPER_KEY — returning mock data for testing")
        return _mock_gmaps(query, market, limit)

    cities = MARKET_CITY.get(market, [""])
    results = []

    for city in cities:
        full_query = f"{query} {city}" if city else query
        log.info(f"Scraping Google Maps: '{full_query}'")

        resp = requests.get(
            "https://api.outscraper.com/maps/search-v3",
            params={
                "query": full_query,
                "limit": min(limit, 500),
                "language": "en",
                "fields": "name,full_address,phone,site,website,business_status,category",
            },
            headers={"X-API-KEY": OUTSCRAPER_KEY},
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()

        # Outscraper returns a task ID for large requests — poll if needed
        if data.get("status") == "Pending":
            task_id = data["id"]
            log.info(f"Task queued ({task_id}), polling…")
            data = _poll_outscraper(task_id)

        for biz in data.get("data", [{}])[0] if isinstance(data.get("data"), list) else []:
            if isinstance(biz, dict):
                biz["_city"] = city
                results.append(biz)

        if len(results) >= limit:
            break
        time.sleep(1)  # rate limit courtesy

    log.info(f"Scraped {len(results)} raw businesses from Google Maps")
    return results[:limit]


def _poll_outscraper(task_id: str, max_wait: int = 120) -> dict:
    for _ in range(max_wait // 5):
        time.sleep(5)
        r = requests.get(
            f"https://api.outscraper.com/requests/{task_id}",
            headers={"X-API-KEY": OUTSCRAPER_KEY},
            timeout=30,
        ).json()
        if r.get("status") == "Success":
            return r
    raise TimeoutError(f"Outscraper task {task_id} did not complete in time")


def _mock_gmaps(query, market, limit):
    """Mock data for local testing without API keys."""
    names = [
        "DataPro Solutions", "Analytics Hub", "Insight Dynamics",
        "CloudMetrics", "BizFlow Tech", "Catalyst Data", "NexGen Analytics",
        "SmartBoard MY", "PivotPoint SG", "Clearview Data",
    ]
    return [
        {
            "name": f"{names[i % len(names)]} {i+1}",
            "full_address": f"{i+1} Jalan Sample, {MARKET_CITY[market][0]}",
            "phone": "+60123456789" if market == "MY" else "+6591234567",
            "site": f"https://company{i+1}.{'com.my' if market == 'MY' else 'sg'}",
            "category": query,
            "_city": MARKET_CITY[market][0],
        }
        for i in range(min(limit, len(names)))
    ]


# ── Hunter.io: email enrichment ───────────────────────────────────────────────
def find_email(domain: str, company_name: str) -> str | None:
    """Try to find a company email via Hunter.io domain search."""
    if not HUNTER_KEY or not domain:
        return None
    try:
        resp = requests.get(
            "https://api.hunter.io/v2/domain-search",
            params={"domain": domain, "api_key": HUNTER_KEY, "limit": 1, "type": "generic"},
            timeout=10,
        )
        data = resp.json().get("data", {})
        emails = data.get("emails", [])
        if emails:
            return emails[0].get("value")
        # Fall back to pattern guess
        pattern = data.get("pattern")
        if pattern:
            return f"info@{domain}"
    except Exception as e:
        log.debug(f"Hunter error for {domain}: {e}")
    return None


def extract_domain(url: str) -> str | None:
    if not url:
        return None
    url = url.strip().lower().rstrip("/")
    url = re.sub(r"^https?://", "", url)
    url = re.sub(r"^www\.", "", url)
    return url.split("/")[0] or None


# ── Phone normalisation ────────────────────────────────────────────────────────
# Mobile-only prefixes — landlines are useless for WhatsApp
MOBILE_PREFIXES = {
    "MY": ["+601", "601", "01"],   # +6011, +6012, +6013 etc — all mobile
    "SG": ["+658", "+659", "+656", "+657"],
    "UK": ["+447"],
    "US": [],  # US landline vs mobile not easily distinguishable by prefix
}

def normalise_phone(phone: str, market: str) -> str | None:
    if not phone:
        return None
    digits = re.sub(r"[^\d+]", "", phone)
    pattern = PHONE_PATTERNS.get(market, r"\+?[0-9]{8,15}")
    if not re.fullmatch(pattern, digits):
        return None
    # For markets where we can distinguish, filter out landlines
    allowed = MOBILE_PREFIXES.get(market, [])
    if allowed and not any(digits.startswith(p) for p in allowed):
        log.debug(f"Skipping landline: {digits}")
        return None
    return digits


# ── Blacklist: skip large venues that aren't useful leads ─────────────────────
SKIP_KEYWORDS = [
    "mall", "megamall", "plaza", "shopping centre", "shopping center",
    "hypermarket", "supermarket", "department store", "convention centre",
    "convention center", "airport", "stadium", "university", "college",
    "klcc", "mydin", "ikea", "giant", "tesco", "aeon", "parkson",
    "pavilion", "mid valley", "avenue k", "central market", "sunway pyramid",
]

def is_blacklisted(name: str) -> bool:
    name_lower = name.lower()
    return any(kw in name_lower for kw in SKIP_KEYWORDS)


# ── Transform raw → lead row ──────────────────────────────────────────────────
def transform(raw: dict, market: str, industry: str, source: str = "Google Maps") -> dict | None:
    name = (raw.get("name") or "").strip()
    if not name:
        return None

    if is_blacklisted(name):
        log.debug(f"Skipping blacklisted: '{name}'")
        return None

    site = raw.get("site") or raw.get("website") or ""
    domain = extract_domain(site)
    raw_phone = re.sub(r"[^\d+]", "", raw.get("phone") or "")
    mobile = normalise_phone(raw.get("phone") or "", market)
    # Try our free email finder first, fall back to Hunter.io
    email = None
    if domain and HAS_EMAIL_FINDER:
        email = find_email_from_website(site)
        if email:
            log.info(f"Email finder: {email} for {name}")
    if not email and domain:
        email = find_email(domain, name)
        if email:
            log.info(f"Hunter.io: {email} for {name}")

    # Keep landlines in notes but do not use as WhatsApp
    is_landline = bool(raw_phone) and not mobile
    notes = f"Landline: {raw_phone}" if is_landline else ""

    # Skip if we have nothing to contact at all
    if not email and not mobile and not is_landline:
        log.debug(f"Skipping '{name}' — no contact info found")
        return None

    return {
        "company":       name,
        "contact_name":  None,          # enriched separately (LinkedIn etc.)
        "email":         email,
        "whatsapp":      mobile,        # only real mobile numbers
        "industry":      industry,
        "market":        market,
        "status":        "new",
        "channel":       "email" if email else "whatsapp",  # phone-only leads default to whatsapp channel, see notes for landline
        "notes":         notes,
        "deal_value":    None,
        "source":        source,
        "created_at":    datetime.now(timezone.utc).isoformat(),
        "last_contacted": None,
    }


# ── Brevo: add contact to Cold Outreach list ─────────────────────────────────
BREVO_LIST_ID = 5  # Cold Outreach list #5

def push_to_brevo(leads: list[dict]) -> int:
    """Push email leads to Brevo and add to Cold Outreach list."""
    if not BREVO_KEY:
        log.warning("No BREVO_API_KEY — skipping Brevo push")
        return 0

    email_leads = [l for l in leads if l.get("email")]
    if not email_leads:
        log.info("No email leads to push to Brevo")
        return 0

    headers = {
        "api-key": BREVO_KEY,
        "Content-Type": "application/json",
    }

    pushed = 0
    for lead in email_leads:
        contact = {
            "email": lead["email"],
            "attributes": {
                "FIRSTNAME": (lead.get("contact_name") or "").split()[0] if lead.get("contact_name") else "",
                "COMPANY":   lead.get("company", ""),
            },
            "listIds": [BREVO_LIST_ID],
            "updateEnabled": True,
        }
        try:
            resp = requests.post(
                "https://api.brevo.com/v3/contacts",
                headers=headers,
                json=contact,
                timeout=10,
            )
            if resp.status_code in (200, 201):
                pushed += 1
                log.info(f"Brevo: added {lead['email']} ({lead['company']})")
            elif resp.status_code == 204:
                pushed += 1
                log.info(f"Brevo: updated {lead['email']} ({lead['company']})")
            else:
                log.warning(f"Brevo error for {lead['email']}: {resp.status_code} {resp.text[:100]}")
        except Exception as e:
            log.warning(f"Brevo exception for {lead.get('email')}: {e}")
        time.sleep(0.2)  # gentle rate limiting

    log.info(f"Brevo: {pushed}/{len(email_leads)} email leads pushed to Cold Outreach list")
    return pushed


# ── Supabase upsert ───────────────────────────────────────────────────────────
def push_to_supabase(leads: list[dict]) -> int:
    if not SUPABASE_URL or not SUPABASE_KEY:
        log.warning("No Supabase config — saving to leads_output.json instead")
        with open("leads_output.json", "w") as f:
            json.dump(leads, f, indent=2)
        log.info(f"Saved {len(leads)} leads → leads_output.json")
        return len(leads)

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }

    batch_size = 100
    inserted = 0
    for i in range(0, len(leads), batch_size):
        batch = leads[i : i + batch_size]
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/leads",
            headers=headers,
            json=batch,
            params={"on_conflict": "company,market"},
            timeout=30,
        )
        if resp.status_code in (200, 201):
            inserted += len(batch)
            log.info(f"Inserted batch {i//batch_size + 1}: {len(batch)} leads")
        else:
            log.error(f"Supabase error {resp.status_code}: {resp.text[:200]}")

    return inserted


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="GigDash lead scraper")
    parser.add_argument("--query",    required=True,  help='e.g. "e-commerce startup"')
    parser.add_argument("--market",   default="MY",   choices=MARKET_CITY.keys())
    parser.add_argument("--industry", default="Other",choices=["Retail","F&B","SaaS","Fintech","IT Services","Legal","E-commerce","Healthcare","Education","Other"])
    parser.add_argument("--limit",    default=50,     type=int, help="Max leads to scrape")
    parser.add_argument("--dry-run",  action="store_true",      help="Skip Supabase push")
    args = parser.parse_args()

    log.info(f"Starting scrape: query='{args.query}' market={args.market} limit={args.limit}")

    # 1. Scrape
    if args.dry_run:
        log.info("Dry run — using mock data, skipping API calls")
        raw_results = _mock_gmaps(args.query, args.market, args.limit)
    else:
        raw_results = scrape_google_maps(args.query, args.market, args.limit)

    # 2. Transform + enrich
    leads = []
    for i, raw in enumerate(raw_results):
        lead = transform(raw, args.market, args.industry)
        if lead:
            leads.append(lead)
        if (i + 1) % 10 == 0:
            log.info(f"Processed {i+1}/{len(raw_results)} — {len(leads)} valid leads so far")
        if HUNTER_KEY:
            time.sleep(0.5)  # Hunter free tier rate limit

    log.info(f"Valid leads after enrichment: {len(leads)}")

    if not leads:
        log.warning("No leads to insert. Try a broader query.")
        return

    # 3. Push
    if args.dry_run:
        print(json.dumps(leads[:3], indent=2))
        log.info(f"Dry run — {len(leads)} leads ready, not pushed")
    else:
        inserted = push_to_supabase(leads)
        log.info(f"Supabase: {inserted} leads pushed.")
        brevo_pushed = push_to_brevo(leads)
        log.info(f"Done. {inserted} to Supabase, {brevo_pushed} to Brevo.")


if __name__ == "__main__":
    main()
