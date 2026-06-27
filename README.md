# Outreach — Lead Enrichment Pipeline (AS OF 6/25) 

Automatically sources prospects via Apollo, scores their blog, finds contacts, and verifies email addresses via Hunter.

---

## Quick start

### 1 — Get API keys

**Apollo.io (free tier)**
1. Sign up at [apollo.io](https://app.apollo.io/#/sign-up)
2. Go to **Settings → Integrations → API** (or visit `/api-keys` in the app)
3. Copy your API key
4. The free tier gives you 50 export credits/month and unlimited people search

**Hunter.io (free tier)**
1. Sign up at [hunter.io](https://hunter.io/users/sign_up)
2. Go to **API → API key** in the dashboard
3. Copy your API key
4. The free tier gives you 25 requests/month

### 2 — Add keys to `.env.local`

Open `.env.local` in the project root and paste your keys:

```
APOLLO_API_KEY=your_apollo_key_here
HUNTER_API_KEY=your_hunter_key_here
```

Restart the dev server after editing `.env.local`.

---

## Running the pipeline

### Via the app

Click **+ Add Prospects** in the top bar. A modal shows live stage-by-stage progress.

### Via CLI

```bash
npm run enrich
```

Logs timing and API credit usage for each stage.

---

## Pipeline stages

| Stage | What it does | API used |
|-------|-------------|---------|
| **1 — Source** | Queries Apollo for 20 companies: seed–Series C, 11–200 employees, $5M+ raised | Apollo (1 credit) |
| **2 — Score blogs** | Fetches each blog, scores 0–100 on recency, length, editorial voice, niche depth | Free (HTTP fetch) |
| **3 — Find contacts** | Searches Apollo for Head of Content / VP Marketing at each company | Apollo (~1 credit/company) |
| **4 — Verify emails** | Verifies via Hunter; falls back to domain search; falls back to guessed pattern | Hunter (~1–2 lookups/contact) |

---

## Email confidence badges

| Badge | Meaning |
|-------|---------|
| **✓ Verified** (green) | Hunter returned `valid` or `accept_all` |
| **~ Likely** (amber) | Hunter returned `risky` — probably deliverable |
| **? Unverified** (gray) | Email was guessed from name pattern — check before sending |

---

## ICP filters (auto-applied)

Companies are automatically skipped if they don't match:
- Funding stage: Seed to Series C
- Employees: 11–200
- Raised: minimum $5M
- Blog score: 40+ / 100

Blog score rubric:
- 25 pts — 2+ posts in last 60 days
- 25 pts — average post length 500+ words
- 25 pts — editorial/thought leadership voice (not changelogs)
- 25 pts — niche or discerning audience signals

---

## Cost estimates

Per pipeline run (20 companies in, ~10–12 through blog filter, ~8–10 with contacts):

| Resource | Est. usage |
|----------|-----------|
| Apollo credits (org search) | 1 |
| Apollo credits (people search) | ~10–12 |
| Hunter lookups | ~16–24 |

---

## What the source badges mean

| Badge | Meaning |
|-------|---------|
| **CSV** | Sourced via Apollo (type label kept for compatibility) |
| **Scraped** | Contact found via Apollo people search |
| **Manual** | Contact was manually entered |
| **Contact needed** | No contact found — add one manually before drafting |
