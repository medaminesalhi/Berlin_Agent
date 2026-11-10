'use strict';

import { Stagehand, tool } from "@browserbasehq/stagehand";
import { z } from "zod";
import dotenv from 'dotenv';
import fs from 'fs';
import { searchUrls } from './lib/searchUrls.js';

dotenv.config();

// Rich console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// SearXNG Search Tool
const searxngSearchTool = tool({
  description: "Search the web using SearXNG to find relevant URLs. Returns a list of search results with titles, URLs, and snippets.",
  inputSchema: z.object({
    query: z.string().describe("The search query string"),
    maxResults: z.number().optional().describe("Maximum number of search results to return"),
  }),
  execute: async ({ query, maxResults }) => {
    try {
      const numResults = maxResults || 10;
      log(`   🔍 Searching SearXNG for: "${query}"`, "blue");
      
      const result = await searchUrls(query, numResults);

      if (!result.success) {
        log(`   ⚠️  Search error: ${result.error}`, "yellow");
        return {
          success: false,
          error: result.error,
          results: [],
        };
      }

      log(`   ✅ Found ${result.count} results`, "green");
      
      return result;
    } catch (error) {
      log(`   ⚠️  Search error: ${error.message}`, "yellow");
      return {
        success: false,
        error: error.message,
        results: [],
      };
    }
  },
});

// Parse command-line arguments
function parseArgs() {
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

function showHelp() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║   🤖 FULLY AUTONOMOUS AGENT: AI Makes All Decisions           ║
║              With SearXNG Search Integration                  ║
╚════════════════════════════════════════════════════════════════╝

USAGE:
  node fully_autonomous_agent.js [OPTIONS]

OPTIONS:
  -p, --prompt <text>       What you want to find/scrape (required)
  -u, --url <url>           Specific URL to scrape (optional)
  -s, --steps <number>      Max steps for agent (default: 50)
  -h, --help                Show this help message

FEATURES:
  • Agent makes ALL decisions autonomously
  • SearXNG search to find relevant URLs
  • Navigates and extracts data automatically
  • Works without knowing the URL beforehand
  • Stops when task is complete

REQUIREMENTS:
  • SearXNG instance running (default: http://localhost:8888)
  • Set SEARXNG_URL environment variable if using different instance

EXAMPLES:
  # Search and scrape (no URL needed)
  node fully_autonomous_agent.js \\
    --prompt "Find and scrape Python tutorial websites"

  # Search for specific information
  node fully_autonomous_agent.js \\
    -p "Find the top 5 React documentation sites and extract their main topics"

  # Direct URL scraping (traditional mode)
  node fully_autonomous_agent.js \\
    --url "http://books.toscrape.com" \\
    --prompt "Scrape all books with titles and prices"

  # Search with more steps
  node fully_autonomous_agent.js \\
    -p "Find JavaScript frameworks and compare their features" \\
    -s 100
  `);
}

// Generic schema for any data
const GenericDataSchema = z.object({
  items: z.array(z.record(z.string(), z.any())),
});

// Main fully autonomous agent
async function fullyAutonomousAgent() {
 
  const args = parseArgs();
  
  if (!args.prompt) {
    log("\n❌ Error: Prompt is required", "red");
    log("   Use: --prompt \"what to find/scrape\"", "yellow");
    process.exit(1);
  }
  
  log("\n" + "=".repeat(70), "cyan");
  log("🚀 STARTING FULLY AUTONOMOUS AGENT", "bright");
  log("=".repeat(70), "cyan");
  log(`📝 Task: ${args.prompt}`, "yellow");
  log(`🌐 URL: ${args.url || 'Will search with SearXNG'}`, "yellow");
  log(`⏱️  Max steps: ${args.maxSteps}`, "yellow");
  log(`🤖 Mode: Fully Autonomous (Agent makes all decisions)`, "yellow");
  log(`🔍 Search: SearXNG (if no URL provided)`, "yellow");
  log(`🌐 Browser: Lightpanda (via CDP)\n`, "yellow");

  let stagehand;
  
  try {
    // Initialize Stagehand with Lightpanda
    log("⏳ Initializing Stagehand with Lightpanda...", "bright");
    const model = process.env.STAGEHAND_MODEL || "azure/gpt-4o-mini";
    const cdpUrl = process.env.LIGHTPANDA_CDP_URL || "ws://127.0.0.1:9222";
    
    stagehand = new Stagehand({
      env: "LOCAL",
      model: model,
      verbose: 1,  // Show agent's thinking
      experimental: true,  // Required for agent output schema
      domSettleTimeout: 30000,
      localBrowserLaunchOptions: {
        cdpUrl: cdpUrl,  // Connect to Lightpanda
      },
    });

    await stagehand.init();
    log("✅ Stagehand connected to Lightpanda\n", "green");
    
    // Create page explicitly for Lightpanda
    const page = await stagehand.context.newPage();
    log("✅ Page created\n", "green");

    // Navigate to URL if provided
    if (args.url) {
      log("⏳ Navigating to URL...", "yellow");
      await page.goto(args.url, { 
        waitUntil: 'load',
        timeout: 60000 
      });
      log("✅ Page loaded\n", "green");
    } else {
      log("ℹ️  No URL provided - agent will use SearXNG search\n", "blue");
    }

    // Create autonomous agent with search tool
    log("🤖 Creating autonomous agent with SearXNG search...", "blue");
    const agent = stagehand.agent({
      model: model,
      mode: "dom",  // DOM mode is faster and more cost-effective
      tools: args.url ? undefined : {
        searxngSearch: searxngSearchTool,
      },
      systemPrompt: args.url ? undefined : `You are an expert web researcher and data scraper with access to the searxngSearch tool.

IMPORTANT: You have a searxngSearch TOOL available. DO NOT navigate to search engine websites manually.

Your workflow when NO URL is provided:
1. CALL TOOL: Use the searxngSearch tool with your search query (e.g., searxngSearch({query: "Python tutorials", maxResults: 10}))
2. ANALYZE RESULTS: Review the URLs returned by the tool
3. NAVIGATE: Use goto to visit the most relevant URLs from the search results
4. EXTRACT: Extract the requested data from each page
5. COMPLETE: Return all extracted data in the items array

CRITICAL INSTRUCTIONS:
- NEVER navigate to google.com, bing.com, searxng.org, or any search engine website
- ALWAYS use the searxngSearch TOOL as your first action
- The tool returns a list of {title, url, snippet} objects
- Visit multiple URLs from the search results to gather complete information
- Extract accurate and complete data from each page
- Return structured data in the format: {items: [{...}, {...}]}`,
    });
    log("✅ Agent created\n", "green");

    // Execute agent
    // log("╔════════════════════════════════════════════════════════════════╗", "cyan");
    // log("║ 🤖 AGENT EXECUTING AUTONOMOUSLY                                ║", "cyan");
    // log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");
    
    // log("💭 Agent is thinking and making decisions...", "blue");
    // if (!args.url) {
    //   log("   The agent will:", "gray");
    //   log("   • Search DuckDuckGo for relevant URLs", "gray");
    //   log("   • Visit the most relevant sites", "gray");
    //   log("   • Extract the requested data", "gray");
    //   log("   • Decide when to stop\n", "gray");
    // } else {
    //   log("   The agent will:", "gray");
    //   log("   • Understand what data to extract", "gray");
    //   log("   • Navigate through pages if needed", "gray");
    //   log("   • Decide when to stop", "gray");
    //   log("   • Extract all relevant data\n", "gray");
    // }

    const startTime = Date.now();
    
    const result = await agent.execute({
      instruction: args.prompt,
      page: page,  // Pass the Lightpanda page
      output: GenericDataSchema,
      maxSteps: args.maxSteps,
    });
    
    const duration = Date.now() - startTime;

    // Check results
    log("\n╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ ✅ AGENT EXECUTION COMPLETE                                    ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");

    // Extract items - handle nested structure
    let items = [];
    if (result.output?.items) {
      items = Array.isArray(result.output.items) ? result.output.items : [result.output.items];
    } else if (result.output?.books) {
      items = Array.isArray(result.output.books) ? result.output.books : [result.output.books];
    } else if (Array.isArray(result.output)) {
      items = result.output;
    } else if (typeof result.output === 'object' && result.output !== null) {
      // If output is an object but not an array, wrap it
      items = [result.output];
    }
    
    if (items.length === 0) {
      log("⚠️  No items extracted", "yellow");
      log("   The agent may need more steps or a clearer prompt", "gray");
    } else {
      log(`✅ Agent extracted ${items.length} items`, "green");
      log(`⏱️  Total time: ${Math.round(duration / 1000)}s`, "gray");
      log(`📊 Steps taken: ${result.steps || 'unknown'}`, "gray");
    }

    // Save results

    const outputFile = `autonomous_agent_${Date.now()}.json`;
    const outputData = {
      timestamp: new Date().toISOString(),
      url: args.url || "Search-based (SearXNG)",
      prompt: args.prompt,
      method: "Fully Autonomous Agent",
      searchEnabled: !args.url,
      searchTool: !args.url ? "SearXNG" : "N/A",
      browser: "Lightpanda (CDP)",
      cdpUrl: cdpUrl,
      model: model,
      maxSteps: args.maxSteps,
      stepsTaken: result.steps || 'unknown',
      completed: result.completed || false,
      totalItems: items.length,
      executionTime: `${Math.round(duration / 1000)}s`,
      items: items,
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
    
    log(`\n💾 Results saved to: ${outputFile}`, "green");
    
    // Show sample
    if (items.length > 0) {
      log("\n📊 Sample of extracted items:", "bright");
      const itemsArray = Array.isArray(items) ? items : [items];
      itemsArray.slice(0, 5).forEach((item, i) => {
        // Handle both object and string items
        let preview;
        if (typeof item === 'object' && item !== null) {
          preview = Object.entries(item)
            .map(([k, v]) => `${k}: ${String(v).substring(0, 50)}`)
            .join(', ');
        } else {
          preview = String(item).substring(0, 100);
        }
        log(`  ${i + 1}. ${preview}`, "blue");
      });
      if (itemsArray.length > 5) {
        log(`  ... and ${itemsArray.length - 5} more`, "gray");
      }
    }
    
    log("\n✅ Done!", "green");
    log("💡 The agent made all decisions autonomously!", "yellow");

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, "red");
    console.error(error.stack);
  } finally {
    if (stagehand) {
      await stagehand.close();
    }
  }
}

// Run agent
fullyAutonomousAgent().catch(console.error);
