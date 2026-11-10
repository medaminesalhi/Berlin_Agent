/**
 * Schema Generation Tool
 * Generates CSS extraction schemas using LLM
 */

import { tool } from "@browserbasehq/stagehand";
import { z } from "zod";
import { generateCssSchema, getCachedSchema } from '../../old/generateSchemaUtil.js';
import { log } from '../utils/logUtils.js';

/**
 * Create schema generation tool
 * @param {Object} page - Stagehand page object
 * @returns {Object} Stagehand tool
 */
export function createSchemaGenerationTool(page) {
  return tool({
    description: "Generate a CSS extraction schema for pages with repeating patterns (e-commerce, listings, etc.). Use this for cost-effective extraction when the same pattern appears multiple times. Returns schema with confidence score.",
    inputSchema: z.object({
      query: z.string().describe("What data to extract (e.g., 'Extract products with title, price, rating')"),
    }),
    execute: async ({ query }) => {
      try {
        log(`   🤖 Generating CSS schema for: "${query}"`, "blue");
        
        const url = page.url();
        const domain = new URL(url).hostname;
        
        // Check cache first
        const cachedSchema = await getCachedSchema(domain);
        if (cachedSchema) {
          log(`   ♻️  Using cached schema (instant, $0)`, "green");
          return {
            success: true,
            schema: cachedSchema,
            cached: true,
            confidence: cachedSchema.confidence,
            message: `Schema loaded from cache. Confidence: ${(cachedSchema.confidence * 100).toFixed(1)}%`
          };
        }
        
        // Capture page structure
        const { formattedTree } = await page.snapshot();
        const html = await page.evaluate(() => document.documentElement.outerHTML);
        
        // Generate schema
        const schema = await generateCssSchema(formattedTree, html, query, url);
        
        log(`   ✅ Schema generated! Confidence: ${(schema.confidence * 100).toFixed(1)}%`, "green");
        
        return {
          success: true,
          schema,
          cached: false,
          confidence: schema.confidence,
          itemsFound: schema.validation.itemsFound,
          message: `Schema generated with ${schema.fields.length} fields. Confidence: ${(schema.confidence * 100).toFixed(1)}%. Found ${schema.validation.itemsFound} items in sample.`
        };
      } catch (error) {
        log(`   ❌ Schema generation failed: ${error.message}`, "red");
        return {
          success: false,
          error: error.message,
          message: `Failed to generate schema: ${error.message}`
        };
      }
    },
  });
}
