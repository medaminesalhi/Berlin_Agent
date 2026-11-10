/**
 * CLI Utilities
 * Command-line argument parsing and help display
 */

/**
 * Parse command-line arguments
 * @returns {Object} Parsed arguments
 */
export function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    url: null,
    prompt: null,
    maxSteps: 50,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--url' || arg === '-u') {
      parsed.url = args[i + 1];
      i++;
    } else if (arg === '--prompt' || arg === '-p') {
      parsed.prompt = args[i + 1];
      i++;
    } else if (arg === '--steps' || arg === '-s') {
      parsed.maxSteps = parseInt(args[i + 1]) || 50;
      i++;
    } else if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    }
  }

  return parsed;
}

/**
 * Display help message
 */
export function showHelp() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║   🤖 SCRAPER: AI-Powered Web Scraping                         ║
║              With SearXNG Search Integration                  ║
╚════════════════════════════════════════════════════════════════╝

USAGE:
  node scraper.js [OPTIONS]

OPTIONS:
  -p, --prompt <text>       What you want to find/scrape (required)
  -u, --url <url>           Specific URL to scrape (optional)
  -s, --steps <number>      Max steps for agent (default: 50)
  -h, --help                Show this help message

FEATURES:
  • Agent makes ALL decisions autonomously
  • SearXNG search to find relevant URLs
  • Intelligent extraction strategy selection
  • Schema-based extraction for cost efficiency
  • LLM extraction for complex pages
  • Automatic caching and reuse
  • Works without knowing the URL beforehand

REQUIREMENTS:
  • SearXNG instance running (default: http://localhost:8888)
  • Set SEARXNG_URL environment variable if using different instance

EXAMPLES:
  # Search and scrape (no URL needed)
  node scraper.js \\
    --prompt "Find and scrape Python tutorial websites"

  # Search for specific information
  node scraper.js \\
    -p "Find the top 5 React documentation sites and extract their main topics"

  # Direct URL scraping (traditional mode)
  node scraper.js \\
    --url "http://books.toscrape.com" \\
    --prompt "Scrape all books with titles and prices"

  # Search with more steps
  node scraper.js \\
    -p "Find JavaScript frameworks and compare their features" \\
    -s 100
  `);
}
