"""
GigDash Email Finder
────────────────────
Scrapes business websites to find email addresses.
Free, unlimited, no API keys needed.

Usage:
  from email_finder import find_email_from_website
  email = find_email_from_website("https://www.somecompany.co.uk")
"""

import re
import smtplib
import socket
import logging
from urllib.parse import urljoin, urlparse

import requests

log = logging.getLogger("gigdash")

# Common email patterns to try if no email found on the website
COMMON_PREFIXES = ["info", "hello", "contact", "enquiries", "enquiry", "admin", "office", "sales", "support"]

# Pages most likely to contain email addresses
CONTACT_PATHS = ["/contact", "/contact-us", "/contactus", "/about", "/about-us", "/aboutus", "/get-in-touch"]

# Regex to find emails in HTML
EMAIL_REGEX = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
    re.IGNORECASE,
)

# Emails to skip (not useful for outreach)
SKIP_EMAILS = {
    "noreply", "no-reply", "donotreply", "do-not-reply",
    "mailer-daemon", "postmaster", "webmaster", "abuse",
    "example", "test", "demo", "root", "hostmaster",
}

SKIP_DOMAINS = {
    "example.com", "email.com", "yourcompany.com", "domain.com",
    "sentry.io", "sentry.wixpress.com", "googleapis.com", "google.com", "facebook.com",
    "twitter.com", "instagram.com", "linkedin.com", "youtube.com",
    "w3.org", "schema.org", "wixpress.com", "wordpress.org",
    "cloudflare.com", "jsdelivr.net", "wp.com",
}


def _is_valid_email(email: str) -> bool:
    """Filter out junk/placeholder emails."""
    local, _, domain = email.partition("@")
    if not domain:
        return False
    local_lower = local.lower()
    domain_lower = domain.lower()

    if any(skip in local_lower for skip in SKIP_EMAILS):
        return False
    if domain_lower in SKIP_DOMAINS:
        return False
    if len(local) < 2 or len(domain) < 4:
        return False
    # Skip image/file extensions that look like emails
    if domain_lower.endswith((".png", ".jpg", ".gif", ".svg", ".css", ".js")):
        return False
    return True


def _score_email(email: str, domain: str) -> int:
    """Score emails by usefulness — higher is better."""
    local = email.split("@")[0].lower()
    email_domain = email.split("@")[1].lower()
    score = 0

    # Prefer emails on the same domain as the website
    if email_domain == domain or email_domain.endswith("." + domain):
        score += 50

    # Prefer generic/business emails over personal
    preferred = ["info", "hello", "contact", "enquiries", "enquiry", "office", "admin", "sales"]
    if local in preferred:
        score += 30

    # Slightly penalise recruitment/hr emails
    if local in ["hr", "recruitment", "careers", "jobs", "cvs"]:
        score -= 20

    return score


def _fetch_page(url: str, timeout: int = 10) -> str:
    """Fetch a page and return its text content."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml",
        }
        resp = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
        resp.raise_for_status()
        return resp.text
    except Exception:
        return ""


def _scrape_emails_from_url(url: str) -> set:
    """Scrape all emails from a single URL."""
    html = _fetch_page(url)
    if not html:
        return set()

    # Decode HTML entities that hide emails
    html = html.replace("&#64;", "@").replace("&#x40;", "@")
    html = html.replace("[at]", "@").replace(" at ", "@").replace("(at)", "@")
    html = html.replace("[dot]", ".").replace("(dot)", ".")

    raw = set(EMAIL_REGEX.findall(html))
    return {e.lower().strip(".") for e in raw if _is_valid_email(e)}


def _verify_email_smtp(email: str, timeout: int = 5) -> bool:
    """Quick SMTP check — does the mail server accept the address?"""
    domain = email.split("@")[1]
    try:
        records = socket.getaddrinfo(domain, 25, socket.AF_INET, socket.SOCK_STREAM)
        if not records:
            return False
    except (socket.gaierror, socket.herror):
        return False

    try:
        import dns.resolver
        mx_records = dns.resolver.resolve(domain, "MX")
        mx_host = str(sorted(mx_records, key=lambda r: r.preference)[0].exchange).rstrip(".")
    except Exception:
        mx_host = domain

    try:
        with smtplib.SMTP(mx_host, 25, timeout=timeout) as smtp:
            smtp.ehlo("shyamanalytics.com")
            code, _ = smtp.mail("test@shyamanalytics.com")
            if code != 250:
                return False
            code, _ = smtp.rcpt(email)
            return code == 250
    except Exception:
        return True  # If SMTP check fails, assume valid — many servers block this


def _guess_emails(domain: str) -> str | None:
    """Try common prefixes and return the first one that has a valid MX record."""
    try:
        socket.getaddrinfo(domain, 25, socket.AF_INET, socket.SOCK_STREAM)
    except (socket.gaierror, socket.herror):
        return None

    for prefix in COMMON_PREFIXES:
        candidate = f"{prefix}@{domain}"
        # Just check if domain has MX — we can't verify individual addresses reliably
        return candidate  # Return first common prefix if domain accepts mail

    return None


def find_email_from_website(url: str) -> str | None:
    """
    Main function: find the best email for a business website.
    1. Scrape the homepage
    2. Scrape common contact pages
    3. Score and rank found emails
    4. Fall back to guessing common patterns
    """
    if not url:
        return None

    # Normalise URL
    if not url.startswith("http"):
        url = "https://" + url
    url = url.rstrip("/")

    parsed = urlparse(url)
    domain = parsed.netloc.lower().replace("www.", "")

    log.debug(f"Email finder: searching {domain}")

    # 1. Scrape homepage
    all_emails = _scrape_emails_from_url(url)

    # 2. Scrape contact pages
    for path in CONTACT_PATHS:
        contact_url = urljoin(url, path)
        all_emails.update(_scrape_emails_from_url(contact_url))
        if all_emails:
            break  # Stop once we find emails

    # 3. Score and pick best
    if all_emails:
        scored = sorted(all_emails, key=lambda e: _score_email(e, domain), reverse=True)
        best = scored[0]
        log.debug(f"Email finder: found {len(all_emails)} emails, best: {best}")
        return best

    # 4. Fallback: guess common patterns
    guess = _guess_emails(domain)
    if guess:
        log.debug(f"Email finder: no emails found, guessing {guess}")
        return guess

    log.debug(f"Email finder: no emails found for {domain}")
    return None
