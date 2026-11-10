/**
 * SearXNG Search Tool
 * Web search integration for autonomous agents
 */

import { tool } from "@browserbasehq/stagehand";
import { z } from "zod";
import { searchUrls } from '../searchUrls.js';
import { log } from '../utils/logUtils.js';

/**
 * Create SearXNG search tool
 * @returns {Object} Stagehand tool
 */
export function createSearchTool() {
  return tool({
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
}
