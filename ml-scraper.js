const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

// If ML_USER_ID is empty, scrape all submitters (default).
// If ML_USER_ID is set, scrape only that user's submissions.
const ML_USER_ID = (process.env.ML_USER_ID ?? '').trim();
const CSV_PATH = path.join(process.cwd(), 'musicleague-submissions.csv');

const SCRAPE_ALL = ML_USER_ID.length === 0;

function csvEscape(value) {
  const str = value == null ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function normalizePoints(pointsText) {
  const text = pointsText == null ? '' : String(pointsText);
  const match = text.replace(/\s+/g, ' ').trim().match(/[-+]?\d+/);
  return match ? match[0] : text.trim();
}

async function scrapeMySubmissions() {
  console.log('Starting Music League scraper...');
  console.log(`Mode: ${SCRAPE_ALL ? 'all submitters' : `single user (${ML_USER_ID})`}`);
  
  // Initialize CSV file with header
  fs.writeFileSync(CSV_PATH, 'League,Round,Submitter,Song,Artist,Album,Rank,Points,Voters\n');
  console.log(`Writing to: ${CSV_PATH}\n`);
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 800 },
    userDataDir: './user-data' // Keeps session persistent
  });

  const page = await browser.newPage();
  let totalSubmissions = 0;
  
  try {
    const startUrl = ML_USER_ID.length > 0
      ? `https://app.musicleague.com/user/${ML_USER_ID}/`
      : 'https://app.musicleague.com/';

    // Go to profile or homepage
    console.log(`Opening Music League: ${startUrl}`);
    await page.goto(startUrl, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if we need to log in
    const currentUrl = page.url();
    const looksLoggedOut = /\/login|\/signin|\/auth/i.test(currentUrl);
    const wrongProfile = ML_USER_ID.length > 0 && !currentUrl.includes(ML_USER_ID);
    if (looksLoggedOut || wrongProfile) {
      console.log('\n⚠️  Please log in to Music League in the browser window...');
      console.log('⚠️  After logging in, navigate back to the start page if needed');
      console.log('⚠️  Then press Enter in this terminal to continue...\n');
      await waitForEnter();
    }
    
    async function collectLeagueLinks() {
      return page.evaluate(() => {
        const links = [];
        // Find all links that go to /l/
        document.querySelectorAll('a[href*="/l/"]').forEach(link => {
          const href = link.href;
          // Extract league ID from URLs like /l/{league_id}/ or /l/{league_id}/something
          const match = href.match(/\/l\/([a-f0-9]+)\//);
          if (match && match[1]) {
            const leagueId = match[1];
            const leagueName = link.textContent.trim();
            if (!links.find(l => l.id === leagueId)) {
              links.push({ id: leagueId, name: leagueName, url: `https://app.musicleague.com/l/${leagueId}/` });
            }
          }
        });
        return links;
      });
    }

    // Get all league links
    console.log('Finding leagues...');
    let leagueLinks = await collectLeagueLinks();
    if (leagueLinks.length === 0) {
      console.log('\n⚠️  Could not find any league links on the current page.');
      console.log('⚠️  Please navigate in the browser to a page that lists your leagues (e.g. your profile).');
      console.log('⚠️  Then press Enter in this terminal to continue...\n');
      await waitForEnter();
      leagueLinks = await collectLeagueLinks();
    }
    
    console.log(`Found ${leagueLinks.length} leagues\n`);
    
    // For each league, get all rounds
    for (let i = 0; i < leagueLinks.length; i++) {
      const league = leagueLinks[i];
      console.log(`[${i + 1}/${leagueLinks.length}] Processing league: ${league.name}`);
      
      await page.goto(league.url, { waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Get all round/result links
      const roundLinks = await page.evaluate(() => {
        const links = [];
        // Look for "Results" buttons or links to rounds
        document.querySelectorAll('a').forEach(link => {
          const href = link.href;
          const text = link.textContent.trim();
          // Match URLs like /l/{league_id}/{round_id}/
          const match = href.match(/\/l\/[a-f0-9]+\/([a-f0-9]+)\//);
          if (match && match[1] && (text.includes('Results') || text.includes('Round') || href.includes('/l/'))) {
            if (!links.find(l => l.url === href)) {
              links.push({ url: href, name: text });
            }
          }
        });
        return links;
      });
      
      console.log(`  Found ${roundLinks.length} rounds`);
      
      // For each round, find your submission
      for (let j = 0; j < roundLinks.length; j++) {
        const round = roundLinks[j];
        console.log(`    Checking round ${j + 1}/${roundLinks.length}...`);
        
        await page.goto(round.url, { waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get the actual round name from the page
        const roundName = await page.evaluate(() => {
          const titleElement = document.querySelector('h5.card-title');
          return titleElement ? titleElement.textContent.trim() : 'Unknown Round';
        });
        
        if (SCRAPE_ALL) {
          const submissions = await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll('.card-body'))
              .filter(card => card.querySelector('h6.card-title a'));

            const results = [];
            for (const card of cards) {
              const nameElement =
                card.querySelector('h6.text-truncate.text-body.fw-semibold') ||
                card.querySelector('h6.text-truncate.fw-semibold') ||
                card.querySelector('h6.text-truncate');
              const songElement = card.querySelector('h6.card-title a');
              const cardTexts = card.querySelectorAll('.card-text');
              const artistElement = cardTexts[0];
              const albumElement = cardTexts[1];
              const rankElement = card.querySelector('.font-monospace.m-0, .font-monospace.text-body-secondary');
              const votesElement = card.querySelector('.col-auto.text-end h3');
              const votersElement = card.querySelector('.text-body-tertiary.fw-semibold');

              const submitter = nameElement?.textContent.trim() || '';
              const song = songElement?.textContent.trim() || '';
              const artist = artistElement?.textContent.trim() || '';
              const album = albumElement?.textContent.trim() || '';
              const rank = rankElement?.textContent.trim() || '';
              const pointsRaw = votesElement?.textContent.trim() || '';
              const voters = votersElement?.textContent.trim() || '';

              if (!song && !artist && !album) continue;

              results.push({ submitter, song, artist, album, rank, pointsRaw, voters });
            }

            // de-dupe common repeats (e.g., sticky card + list card)
            const seen = new Set();
            return results.filter(r => {
              const key = [r.submitter, r.song, r.artist, r.album, r.rank, r.points].join('|');
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          });

          for (const submission of submissions) {
            const csvRow = [
              csvEscape(league.name),
              csvEscape(roundName),
              csvEscape(submission.submitter),
              csvEscape(submission.song),
              csvEscape(submission.artist),
              csvEscape(submission.album),
              csvEscape(submission.rank),
              csvEscape(normalizePoints(submission.pointsRaw)),
              csvEscape(submission.voters)
            ].join(',') + '\n';
            fs.appendFileSync(CSV_PATH, csvRow);
            totalSubmissions++;
          }

          console.log(`      ✓ Found ${submissions.length} submissions`);
        } else {
          // Find your submission (the card with your name)
          const submission = await page.evaluate((userId) => {
            const cards = document.querySelectorAll('.card-body.sticky-top');

            for (const card of cards) {
              const userLink = card.querySelector(`a[href*="/user/${userId}"]`);
              if (!userLink) continue;

              const nameElement =
                card.querySelector('h6.text-truncate.text-body.fw-semibold') ||
                card.querySelector('h6.text-truncate.fw-semibold') ||
                card.querySelector('h6.text-truncate');
              const songElement = card.querySelector('h6.card-title a');
              const cardTexts = card.querySelectorAll('.card-text');
              const artistElement = cardTexts[0];
              const albumElement = cardTexts[1];
              const rankElement = card.querySelector('.font-monospace.m-0, .font-monospace.text-body-secondary');
              const votesElement = card.querySelector('.col-auto.text-end h3');
              const votersElement = card.querySelector('.text-body-tertiary.fw-semibold');

              return {
                submitter: nameElement?.textContent.trim() || '',
                song: songElement?.textContent.trim() || '',
                artist: artistElement?.textContent.trim() || '',
                album: albumElement?.textContent.trim() || '',
                rank: rankElement?.textContent.trim() || '',
                pointsRaw: votesElement?.textContent.trim() || '',
                voters: votersElement?.textContent.trim() || ''
              };
            }

            return null;
          }, ML_USER_ID);

          if (submission) {
            // Write immediately to CSV
            const csvRow = [
              csvEscape(league.name),
              csvEscape(roundName),
              csvEscape(submission.submitter || ML_USER_ID),
              csvEscape(submission.song),
              csvEscape(submission.artist),
              csvEscape(submission.album),
              csvEscape(submission.rank),
              csvEscape(normalizePoints(submission.pointsRaw)),
              csvEscape(submission.voters)
            ].join(',') + '\n';
            fs.appendFileSync(CSV_PATH, csvRow);
            totalSubmissions++;

            console.log(`      ✓ Found: ${submission.song} by ${submission.artist}`);
          }
        }
      }
    }
    
    console.log(`\n\n✅ Total submissions found: ${totalSubmissions}`);
    console.log(`✅ Submissions saved to: ${CSV_PATH}`);
    
    console.log('\n⚠️  Press Enter to close the browser...');
    await waitForEnter();
    
  } catch (error) {
    console.error('Error during scraping:', error);
    console.log(`\nPartial results saved to: ${CSV_PATH}`);
  } finally {
    await browser.close();
    process.stdin.pause(); // Close stdin
    process.exit(0); // Force exit
  }
}

function waitForEnter() {
  return new Promise(resolve => {
    process.stdin.once('data', () => resolve());
  });
}

scrapeMySubmissions();