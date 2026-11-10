#!/usr/bin/env node
'use strict';

/**
 * Scraper
 * AI-powered web scraping with intelligent extraction
 * 
 * Features:
 * - SearXNG search integration
 * - Intelligent extraction strategy selection
 * - Schema-based extraction for cost efficiency
 * - LLM extraction for complex pages
 * - Automatic caching and reuse
 */

import dotenv from 'dotenv';
import { parseArgs } from '../lib/utils/cliUtils.js';
import { log } from '../lib/utils/logUtils.js';
import { initializeBrowser, navigateToUrl } from '../lib/agent/browserSetup.js';
import { createAgent, GenericDataSchema } from '../lib/agent/agentConfig.js';
import { createSearchTool } from '../lib/tools/searchTool.js';
import { createPageAnalysisTool } from '../lib/tools/pageAnalysisTool.js';
import { createSchemaGenerationTool } from '../lib/tools/schemaGenerationTool.js';
import { createSchemaExtractionTool } from '../lib/tools/schemaExtractionTool.js';
import { 
  saveResults, 
  saveIncremental, 
  displaySample, 
  extractItemsFromResult 
} from '../lib/utils/resultsManager.js';

dotenv.config();

/**
 * Main scraper execution
 */
async function scraper() {
  const args = parseArgs();
  
  if (!args.prompt) {
    log("\n❌ Error: Prompt is required", "red");
    log("   Use: --prompt \"what to find/scrape\"", "yellow");
    process.exit(1);
  }
  
  // Display startup banner
  log("\n" + "=".repeat(70), "cyan");
  log("🚀 STARTING SCRAPER", "bright");
  log("=".repeat(70), "cyan");
  log(`📝 Task: ${args.prompt}`, "yellow");
  log(`🌐 URL: ${args.url || 'Will search with SearXNG'}`, "yellow");
  log(`⏱️  Max steps: ${args.maxSteps}`, "yellow");
  log(`🤖 Mode: Autonomous (Agent makes all decisions)`, "yellow");
  log(`🔍 Search: SearXNG (if no URL provided)`, "yellow");
  log(`🌐 Browser: Lightpanda (via CDP)\n`, "yellow");

  let stagehand;
  
  // Create incremental save file
  const timestamp = Date.now();
  const incrementalFile = `results/scraper_${timestamp}_incremental.json`;
  const allExtractedItems = [];
  
  try {
    // Initialize browser
    const browserSetup = await initializeBrowser();
    stagehand = browserSetup.stagehand;
    const page = browserSetup.page;

    // Navigate to URL if provided
    await navigateToUrl(page, args.url);

    // Create agent with intelligent extraction tools
    log("🤖 Creating autonomous agent with intelligent extraction...", "blue");
    log(`💾 Incremental save file: ${incrementalFile}`, "gray");
    
    const tools = {
      analyzePage: createPageAnalysisTool(page),
      generateSchema: createSchemaGenerationTool(page),
      extractWithSchema: createSchemaExtractionTool(page, allExtractedItems, incrementalFile, args),
    };
    
    // Add search tool if no URL provided
    if (!args.url) {
      tools.searxngSearch = createSearchTool();
    }
    
    const agent = createAgent(stagehand, tools, !!args.url);
    log("✅ Agent created with intelligent extraction tools\n", "green");

    // Execute agent
    const startTime = Date.now();
    
    const result = await agent.execute({
      instruction: args.prompt,
      page: page,  // Pass the Lightpanda page
      output: GenericDataSchema,
      maxSteps: args.maxSteps,
    });
    
    const duration = Date.now() - startTime;

    // Display completion banner
    log("\n╔════════════════════════════════════════════════════════════════╗", "cyan");
    log("║ ✅ AGENT EXECUTION COMPLETE                                    ║", "cyan");
    log("╚════════════════════════════════════════════════════════════════╝\n", "cyan");

    // Extract items from result
    let items = extractItemsFromResult(result);
    
    // Use incrementally saved items if agent output is empty
    if (items.length === 0 && allExtractedItems.length > 0) {
      log("⚠️  Agent output empty, but incremental save has data!", "yellow");
      log(`   Using ${allExtractedItems.length} items from incremental save`, "yellow");
      items = allExtractedItems;
    }
    
    // Display results summary
    if (items.length === 0) {
      log("⚠️  No items extracted", "yellow");
      log("   The agent may need more steps or a clearer prompt", "gray");
      log(`   Check incremental file: ${incrementalFile}`, "gray");
    } else {
      log(`✅ Agent extracted ${items.length} items`, "green");
      log(`⏱️  Total time: ${Math.round(duration / 1000)}s`, "gray");
      log(`📊 Steps taken: ${result.steps || 'unknown'}`, "gray");
    }

    // Save final results
    const outputFile = saveResults(items, {
      url: args.url,
      prompt: args.prompt,
      cdpUrl: process.env.LIGHTPANDA_CDP_URL,
      maxSteps: args.maxSteps,
      stepsTaken: result.steps,
      completed: result.completed,
      executionTime: `${Math.round(duration / 1000)}s`,
    });
    
    log(`\n💾 Results saved to: ${outputFile}`, "green");
    log(`💾 Incremental saves: ${incrementalFile}`, "green");
    
    // Display sample
    displaySample(items);
    
    log("\n✅ Done!", "green");
    log("💡 The agent made all decisions autonomously!", "yellow");
    log(`💡 Data saved incrementally - check ${incrementalFile} for all extracted items!`, "yellow");

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, "red");
    console.error(error.stack);
  } finally {
    if (stagehand) {
      await stagehand.close();
    }
  }
}

// Run scraper
scraper().catch(console.error);
