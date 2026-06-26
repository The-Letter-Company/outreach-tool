# Outreach — Lead Enrichment Pipeline (AS OF 6/25) 

Automatically validates prospects from a CSV, scores their blog, finds contacts, and constructs email addresses. Entirely free — no API keys required.

---

## How to add prospects

### Step 1 — Export a CSV

**From Crunchbase (free tier)**
1. Search for companies by stage (Seed, Series A, etc.) + industry
2. Click a company → copy: name, domain, stage, raised amount, employee count
3. Paste into `data/import.csv`

**From Dealroom (free tier at app.dealroom.co)**
1. Use filters: funding stage, HQ, team size, sector
2. Export CSV (free tier allows limited exports)
3. Map columns to the format below

**From LinkedIn (manual)**
1. Search companies → filter by employee count + industry
2. Visit each company page → note domain + funding from About tab

---

### Step 2 — Fill in the CSV

Open `data/import.csv`. Required columns:

| Column | Required | Example |
|---|---|---|
| `name` | Yes | PostHog |
| `domain` | Yes | posthog.com |
| `stage` | Yes | Series B |
| `raised` | Yes | 27000000 |
| `employees` | Yes | 50 |
| `blogUrl` | No | https://posthog.com/blog |
| `contactName` | No | James Hawkins |
| `contactTitle` | No | Head of Content |
| `contactEmail` | No | james@posthog.com |

- `stage` must be exactly one of: `Seed`, `Series A`, `Series B`, `Series C`
- `raised` is the total raised in dollars (no $ sign, no commas)
- `blogUrl`, `contactName`, `contactTitle`, `contactEmail` are optional — the pipeline will attempt to find them automatically

---

### Step 3 — Run the pipeline

```bash
npm run enrich
```

This will:
1. Read and validate companies from `data/import.csv`
2. Find and score each company's blog (0–100)
3. Scrape `/about` and `/team` pages for contacts
4. Construct email address patterns + verify domain has MX records
5. Merge new prospects into `data/prospects.json` (existing prospects are never overwritten)

Or click **+ Add Prospects** in the app — same pipeline, live progress modal.

---

## ICP filters (auto-applied)

Companies are automatically skipped if they don't match:
- Funding stage: Seed to Series C
- Raised: minimum $5M
- Employees: 10–500
- Blog score: 40+ / 100

Blog score rubric:
- 25 pts — 2+ posts in last 60 days
- 25 pts — average post length 500+ words
- 25 pts — editorial/thought leadership voice (not changelogs)
- 25 pts — niche or discerning audience signals

---

## What the badges mean

| Badge | Meaning |
|---|---|
| **CSV** | Company came from `data/import.csv` |
| **Manual** | Company or contact was manually entered |
| **Scraped** | Contact name/title was scraped from the company's /about or /team page |
| **Unverified email** | Email was constructed from name pattern (e.g. `james@domain.com`) — MX records confirmed the domain accepts email, but the address itself is unverified. Check before sending. |
| **Contact needed** | No contact was found — add one manually before drafting |

---

## Cost

$0. The pipeline uses only:
- HTTP fetch (blog scraping)
- DNS MX lookup (email domain check)
- CSV file reading

No API keys. No paid services. The tradeoff is that email addresses are unverified — always check before sending.
