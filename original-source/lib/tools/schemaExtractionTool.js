/**
 * Schema Extraction Tool
 * Extracts data using CSS schemas (fast, no LLM cost)
 */

import { tool } from "@browserbasehq/stagehand";
import { z } from "zod";
import { extractWithSchemaAndConfidence } from '../../old/generateSchemaUtil.js';
import { saveIncremental } from '../utils/resultsManager.js';
import { log } from '../utils/logUtils.js';

/**
 * Create schema extraction tool
 * @param {Object} page - Stagehand page object
 * @param {Array} allExtractedItems - Array to accumulate extracted items
 * @param {string} incrementalFile - Path to incremental save file
 * @param {Object} args - CLI arguments
 * @returns {Object} Stagehand tool
 */
export function createSchemaExtractionTool(page, allExtractedItems, incrementalFile, args) {
  return tool({
    description: "Extract data using a previously generated CSS schema. Very fast and cost-effective (no LLM calls). Use after generating schema with generateSchema tool.",
    inputSchema: z.object({
      schema: z.any().describe("The CSS schema object from generateSchema tool"),
    }),
    execute: async ({ schema }) => {
      try {
        log(`   ⚡ Extracting data with CSS schema...`, "blue");
        
        const result = await extractWithSchemaAndConfidence(page, schema);
        
        log(`   ✅ Extracted ${result.itemCount} items (confidence: ${(result.finalConfidence * 100).toFixed(1)}%)`, "green");
        
        // Add items to collection
        allExtractedItems.push(...result.items);
        
        // Save incrementally
        saveIncremental(allExtractedItems, incrementalFile, {
          url: args.url,
          prompt: args.prompt,
          lastExtraction: {
            itemCount: result.itemCount,
            confidence: result.finalConfidence,
            pageUrl: page.url()
          }
        });
        
        return {
          success: true,
          items: result.items,
          count: result.itemCount,
          confidence: result.finalConfidence,
          message: `Successfully extracted ${result.itemCount} items. Total so far: ${allExtractedItems.length}. Confidence: ${(result.finalConfidence * 100).toFixed(1)}%`
        };
      } catch (error) {
        log(`   ❌ Extraction failed: ${error.message}`, "red");
        return {
          success: false,
          error: error.message,
          items: [],
          count: 0,
          message: `Failed to extract data: ${error.message}`
        };
      }
    },
  });
}
