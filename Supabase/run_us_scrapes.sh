#!/bin/bash
cd ~/Documents/Gig\ Dashboard/Supabase

# US Accounting firms
python scraper.py --query "accounting firm new york" --market US --industry "Other" --limit 20
python scraper.py --query "accounting firm san francisco" --market US --industry "Other" --limit 20
python scraper.py --query "accounting firm austin" --market US --industry "Other" --limit 20

# US Law firms
python scraper.py --query "law firm new york" --market US --industry "Legal" --limit 20
python scraper.py --query "law firm san francisco" --market US --industry "Legal" --limit 20
python scraper.py --query "law firm austin" --market US --industry "Legal" --limit 20

# US Marketing agencies
python scraper.py --query "marketing agency new york" --market US --industry "Other" --limit 20
python scraper.py --query "marketing agency san francisco" --market US --industry "Other" --limit 20
python scraper.py --query "marketing agency austin" --market US --industry "Other" --limit 20

echo "Done. Check Brevo for results."
