const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const USER_ID = '21efc313fb234af18f094d644f5980ac'; // Your user ID from the URL
const CSV_PATH = path.join(process.cwd(), 'musicleague-submissions.csv');

async function scrapeMySubmissions() {
  console.log('Starting Music League scraper...');
  
  // Initialize CSV file with header
  fs.writeFileSync(CSV_PATH, 'League,Round,Song,Artist,Album,Rank,Points,Voters\n');
  console.log(`Writing to: ${CSV_PATH}\n`);
  
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 800 },
    userDataDir: './user-data' // Keeps session persistent
  });

  const page = await browser.newPage();
  let totalSubmissions = 0;
  
  try {
    // Go to your user page
    console.log('Opening your Music League profile...');
    await page.goto(`https://app.musicleague.com/user/${USER_ID}/`, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if we need to log in
    const currentUrl = page.url();
    if (!currentUrl.includes(USER_ID)) {
      console.log('\n⚠️  Please log in to Music League in the browser window...');
      console.log('⚠️  After logging in, navigate back to your profile if needed');
      console.log('⚠️  Then press Enter in this terminal to continue...\n');
      await waitForEnter();
    }
    
    // Get all league links
    console.log('Finding all your leagues...');
    const leagueLinks = await page.evaluate(() => {
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
        
        // Find your submission (the card with your name)
        const submission = await page.evaluate((userName) => {
          // Find the card that contains your name
          const cards = document.querySelectorAll('.card-body.sticky-top');
          
          for (const card of cards) {
            const nameElement = card.querySelector('h6.text-truncate.text-body.fw-semibold');
            if (nameElement && nameElement.textContent.includes(userName)) {
              // Found your submission!
              const songElement = card.querySelector('h6.card-title a');
              const artistElement = card.querySelectorAll('.card-text')[0];
              const albumElement = card.querySelectorAll('.card-text')[1];
              const rankElement = card.querySelector('.font-monospace.m-0, .font-monospace.text-body-secondary');
              const votesElement = card.querySelector('.col-auto.text-end h3');
              const votersElement = card.querySelector('.text-body-tertiary.fw-semibold');
              
              return {
                song: songElement?.textContent.trim() || '',
                artist: artistElement?.textContent.trim() || '',
                album: albumElement?.textContent.trim() || '',
                rank: rankElement?.textContent.trim() || '',
                points: votesElement?.textContent.trim() || '',
                voters: votersElement?.textContent.trim() || ''
              };
            }
          }
          return null;
        }, 'Ahmad Saeed'); // Use your actual name
        
        if (submission) {
          // Write immediately to CSV
          const csvRow = `"${league.name}","${roundName}","${submission.song}","${submission.artist}","${submission.album}","${submission.rank}","${submission.points}","${submission.voters}"\n`;
          fs.appendFileSync(CSV_PATH, csvRow);
          totalSubmissions++;
          
          console.log(`      ✓ Found: ${submission.song} by ${submission.artist}`);
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