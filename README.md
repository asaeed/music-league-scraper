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

## Run

```bash
./run.sh
```

Or directly:

```bash
node ml-scraper.js
```

On first run, a browser window will open. If you’re logged out, log into Music League, then return to your profile and press **Enter** in the terminal to continue.

## Output

- CSV file: `musicleague-submissions.csv`
- Columns: `League, Round, Song, Artist, Album, Rank, Points, Voters`

## Configure

Edit the constants near the top of `ml-scraper.js`:

- `USER_ID`: your Music League user id from your profile URL
- The name passed into the page evaluator (currently hardcoded as `Ahmad Saeed`)

## Notes / Safety

- `user-data/` contains cookies and local browser state. It is ignored by git via `.gitignore` and should not be committed.
- This is a best-effort scraper; if the Music League site changes, selectors may need updates.
