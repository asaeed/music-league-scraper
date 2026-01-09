# Music League submissions scraper

Scrapes **your** Music League round submissions and writes them to a CSV.

- Opens a real Chrome window via Puppeteer
- Uses a persistent Chrome profile in `user-data/` so you only log in once
- Writes results to `musicleague-submissions.csv`

## Prerequisites

- Node.js (recommended: current LTS)

## Install

```bash
npm install
```

## Configure

Create a `.env` file (or copy `.env.example`):

```bash
cp .env.example .env
```

Edit `.env`:

- `ML_USER_ID`: your Music League user id from your profile URL (required)
- `ML_SCRAPE_MODE`: 
  - `all` (default) — scrape all submitters per round
  - `single` — scrape only your submissions

## Run

```bash
./run.sh
```

### Windows

```bat
run.cmd
```

Or directly:

```bash
node ml-scraper.js
```

On first run, a browser window will open. If you’re logged out, log into Music League, then return to your profile and press **Enter** in the terminal to continue.

## Output

- CSV file: `musicleague-submissions.csv`
- Columns: `League, Round, Submitter, Song, Artist, Album, Rank, Points, Voters`

## Notes / Safety

- `user-data/` contains cookies and local browser state. It is ignored by git via `.gitignore` and should not be committed.
- `.env` contains your user id and is also ignored by git.
- This is a best-effort scraper; if the Music League site changes, selectors may need updates.
