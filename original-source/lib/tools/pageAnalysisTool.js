/**
 * Page Analysis Tool
 * Analyzes page structure to determine best extraction strategy
 */

import { tool } from "@browserbasehq/stagehand";
import { z } from "zod";
import { log } from '../utils/logUtils.js';

/**
 * Create page analysis tool
 * @param {Object} page - Stagehand page object
 * @returns {Object} Stagehand tool
 */
export function createPageAnalysisTool(page) {
  return tool({
    description: "Analyze if the current page has repeating patterns suitable for schema-based extraction. Returns recommendation on whether to use schema extraction or LLM extraction.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        log(`   🔍 Analyzing page structure...`, "blue");
        
        const analysis = await page.evaluate(() => {
          // Count repeating elements
          const selectors = [
            'article',
            '.product',
            '.item',
            '[class*="product"]',
            '[class*="item"]',
            'li[class*="list"]',
            'div[class*="card"]',
            'tr[class*="row"]'
          ];
          
          let maxRepeating = 0;
          let bestSelector = null;
          
          for (const selector of selectors) {
            try {
              const elements = document.querySelectorAll(selector);
              if (elements.length > maxRepeating) {
                maxRepeating = elements.length;
                bestSelector = selector;
              }
            } catch (e) {
              // Invalid selector, skip
            }
          }
          
          // Check for pagination
          const paginationSelectors = [
            'a[href*="page"]',
            'a[href*="?p="]',
            '.pagination',
            '[class*="pag"]',
            'a[rel="next"]'
          ];
          
          let hasPagination = false;
          for (const selector of paginationSelectors) {
            if (document.querySelector(selector)) {
              hasPagination = true;
              break;
            }
          }
          
          return {
            repeatingCount: maxRepeating,
            bestSelector,
            hasPagination,
            url: window.location.href
          };
        });
        
        // Determine recommendation
        const useSchema = analysis.repeatingCount >= 5;
        const reason = useSchema 
          ? `Found ${analysis.repeatingCount} repeating elements (${analysis.bestSelector}). Schema extraction recommended for cost efficiency.`
          : `Only ${analysis.repeatingCount} repeating elements found. LLM extraction recommended for better accuracy.`;
        
        log(`   ${useSchema ? '✅' : '⚠️'} ${reason}`, useSchema ? "green" : "yellow");
        
        return {
          success: true,
          useSchema,
          repeatingCount: analysis.repeatingCount,
          bestSelector: analysis.bestSelector,
          hasPagination: analysis.hasPagination,
          reason,
          message: reason
        };
      } catch (error) {
        log(`   ⚠️  Analysis failed: ${error.message}`, "yellow");
        return {
          success: false,
          useSchema: false,
          reason: `Analysis failed: ${error.message}. Defaulting to LLM extraction.`,
          message: `Could not analyze page. Use LLM extraction.`
        };
      }
    },
  });
}
