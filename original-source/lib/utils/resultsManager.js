/**
 * Results Management
 * Handles saving and displaying extraction results
 */

import fs from 'fs';
import { log } from './logUtils.js';

/**
 * Save results to JSON file
 * @param {Array} items - Extracted items
 * @param {Object} metadata - Metadata about the extraction
 * @returns {string} Output file path
 */
export function saveResults(items, metadata) {
  const outputFile = `results/scraper_${Date.now()}.json`;
  const outputData = {
    timestamp: new Date().toISOString(),
    url: metadata.url || "Search-based (SearXNG)",
    prompt: metadata.prompt,
    method: "AI-Powered Scraper with Intelligent Extraction",
    features: {
      searchEnabled: !metadata.url,
      searchTool: !metadata.url ? "SearXNG" : "N/A",
      intelligentExtraction: true,
      schemaGeneration: true,
      costOptimization: true,
    },
    browser: "Lightpanda (CDP)",
    cdpUrl: metadata.cdpUrl || "ws://127.0.0.1:9222",
    model: metadata.model || "Not specified",
    maxSteps: metadata.maxSteps,
    stepsTaken: metadata.stepsTaken || 'unknown',
    completed: metadata.completed || false,
    totalItems: items.length,
    executionTime: metadata.executionTime,
    items: items,
  };
  
  fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
  return outputFile;
}

/**
 * Save incremental results during extraction
 * @param {Array} allItems - All items collected so far
 * @param {string} incrementalFile - File path for incremental saves
 * @param {Object} metadata - Metadata about current extraction
 */
export function saveIncremental(allItems, incrementalFile, metadata) {
  const incrementalData = {
    timestamp: new Date().toISOString(),
    url: metadata.url || "Search-based (SearXNG)",
    prompt: metadata.prompt,
    method: "AI-Powered Scraper with Intelligent Extraction (Incremental Save)",
    totalItemsSoFar: allItems.length,
    lastExtraction: metadata.lastExtraction,
    items: allItems
  };
  
  fs.writeFileSync(incrementalFile, JSON.stringify(incrementalData, null, 2));
  log(`   💾 Saved ${allItems.length} items to incremental file`, "gray");
}

/**
 * Display sample of extracted items
 * @param {Array} items - Extracted items
 */
export function displaySample(items) {
  if (items.length === 0) return;
  
  log("\n📊 Sample of extracted items:", "bright");
  items.slice(0, 5).forEach((item, i) => {
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
  if (items.length > 5) {
    log(`  ... and ${items.length - 5} more`, "gray");
  }
}

/**
 * Extract items from agent result (handles various formats)
 * @param {Object} result - Agent execution result
 * @returns {Array} Extracted items
 */
export function extractItemsFromResult(result) {
  let items = [];
  
  if (result.output?.items) {
    items = result.output.items;
  } else if (result.output?.books) {
    items = result.output.books;
  } else if (Array.isArray(result.output)) {
    items = result.output;
  }
  
  return items;
}
