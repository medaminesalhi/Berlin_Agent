/**
 * Browser Setup
 * Handles Lightpanda/Stagehand initialization and configuration
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { log } from '../utils/logUtils.js';

/**
 * Build model configuration for Stagehand based on provider
 * @param {Object} provider - LLM provider configuration from frontend
 * @returns {Object|string} Model config object or model string
 */
function buildModelConfig(provider) {
  // If no provider passed, use env vars with default model string
  if (!provider) {
    const model = process.env.STAGEHAND_MODEL || "azure/gpt-4o-mini";
    return model;
  }

  // Handle Ollama with custom baseURL
  if (provider.type === "ollama") {
    return {
      modelName: `ollama/${provider.model}`,
      baseURL: provider.baseUrl || "http://localhost:11434"
    };
  }

  // Handle Azure with apiVersion and deployment
  if (provider.type === "azure") {
    const config = {
      modelName: `azure/${provider.model}`
    };
    if (provider.apiVersion) config.apiVersion = provider.apiVersion;
    if (provider.deployment) config.deployment = provider.deployment;
    if (provider.apiKey) config.apiKey = provider.apiKey;
    return config;
  }

  // Handle custom providers with baseURL
  if (provider.type === "custom" && provider.baseUrl) {
    return {
      modelName: provider.model,
      baseURL: provider.baseUrl,
      apiKey: provider.apiKey
    };
  }

  // Handle standard providers (OpenAI, Anthropic, Groq, DeepSeek)
  const modelName = `${provider.type}/${provider.model}`;
  if (provider.apiKey) {
    return {
      modelName,
      apiKey: provider.apiKey
    };
  }
  
  return modelName;
}

/**
 * Initialize Stagehand with Lightpanda
 * @param {Object} provider - Optional LLM provider configuration
 * @returns {Promise<Object>} { stagehand, page }
 */
export async function initializeBrowser(provider = null) {
  log("⏳ Initializing Stagehand with Lightpanda...", "bright");
  const cdpUrl = process.env.LIGHTPANDA_CDP_URL || "ws://127.0.0.1:9222";
  
  const modelConfig = buildModelConfig(provider);
  
  // Debug logging
  console.log("🔍 Provider received:", JSON.stringify(provider, null, 2));
  console.log("🔍 Model config built:", JSON.stringify(modelConfig, null, 2));
  
  const stagehand = new Stagehand({
    env: "LOCAL",
    model: modelConfig,
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
  
  return { stagehand, page };
}

/**
 * Navigate to URL if provided
 * @param {Object} page - Stagehand page object
 * @param {string|null} url - URL to navigate to
 */
export async function navigateToUrl(page, url) {
  if (!url) {
    log("ℹ️  No URL provided - agent will use SearXNG search\n", "blue");
    return;
  }
  
  log("⏳ Navigating to URL...", "yellow");
  await page.goto(url, { 
    waitUntil: 'load',
    timeout: 60000 
  });
  log("✅ Page loaded\n", "green");
}
