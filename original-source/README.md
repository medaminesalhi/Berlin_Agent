# Stagehand AI Automation Experiments

This repository showcases advanced autonomous web scraping and browser automation using the **Stagehand** framework. It explores various Stagehand architectural patterns with **flexible browser engine support** (built-in browser, Lightpanda, or remote services) and multiple LLM providers (Azure OpenAI, NVIDIA NIM).

## Stagehand Architecture Focus

Stagehand is fundamentally a **hybrid browser automation architecture** designed to combine deterministic code with AI-powered flexibility. Instead of choosing between brittle DOM selectors and opaque fully autonomous agents, Stagehand provides a layered control system.

### Core Architectural Primitives

Stagehand is organized around four top-level capabilities used extensively in this repository:

**1. `observe`:**  
Inspects the current page using natural language intent to find candidate actions without immediate execution. Returns a list of action objects tied to the current DOM.
```javascript
const actions = await stagehand.observe("find the search button");
// Returns: [{selector: "button.search", action: "click", description: "Click search button"}]
```

**2. `act`:**  
Executes a targeted AI-guided interaction on the page (e.g., clicking, typing) capable of understanding UI intent over strict selectors. Can use natural language or replay cached action objects.
```javascript
await stagehand.act("click the submit button"); // Natural language
await stagehand.act(observedActions[0]); // Replay observed action
```

**3. `extract`:**  
Performs structured extraction with schema validation (using Zod in JS/TS), maintaining a hard boundary for data shape. Fails fast if output doesn't match schema.
```javascript
const products = await stagehand.extract(
  "Get all product titles and prices",
  z.object({ products: z.array(z.object({ title: z.string(), price: z.string() })) })
);
```

**4. `agent`:**  
Runs autonomous multi-step workflows. It bridges the gap between explicit commands (`observe`/`act`/`extract`) by forming an internal loop to accomplish complex, open-ended tasks bounded by `maxSteps`.
```javascript
const result = await agent.execute({
  instruction: "Scrape top 50 products and sort by price",
  maxSteps: 30,
  output: ProductSchema // Zod schema
});
```

## Tools and Modes

Stagehand provides two powerful customization mechanisms: **tools** (custom functions available to agents) and **modes** (execution strategies for the agent).

### Agent Tools

Tools are custom functions that agents can invoke during `agent.execute()` to perform specialized operations. This repository includes practical examples:

**Built-in Tool Definition Pattern:**
```javascript
const customTools = {
  filterData: tool({
    description: "Filter items by criteria",
    parameters: z.object({
      items: z.array(z.object({})),
      filterField: z.string(),
      operator: z.enum(["equals", "contains", "greaterThan", "lessThan"])
    }),
    execute: async ({ items, filterField, operator, filterValue }) => {
      return items.filter(item => {
        // Your filtering logic
      });
    }
  }),
  
  sortData: tool({
    description: "Sort items by field",
    parameters: z.object({ items: z.array(z.object({})), sortField: z.string() }),
    execute: async ({ items, sortField }) => {
      return [...items].sort((a, b) => /* sorting logic */);
    }
  })
};

const agent = stagehand.agent({
  model: "azure/gpt-4o-mini",
  tools: customTools
});
```

**Real-World Example (from `tests/agentic/azure_scraper_with_tools.js`):**

This repository includes 5 production-ready tools:
- **`filterData`** — Filter items by field value (equals, contains, greaterThan, lessThan, startsWith)
- **`sortData`** — Sort items ascending/descending by any field
- **`deduplicateData`** — Remove duplicates based on unique identifier field
- **`extractFields`** — Keep only specified fields from items
- **`getStatistics`** — Calculate analytics: count, sum, average, min, max, median

When an agent has access to tools, it can invoke them autonomously:
```
Agent reasoning: "The user wants products under $100. I should use filterData."
→ Agent calls filterData(items, field="price", operator="lessThan", value=100)
→ Result: Filtered product list
```

**When to Use Tools:**
- Post-processing extracted data (filtering, sorting, deduplication)
- Calculating analytics or aggregations
- Complex transformations that require deterministic logic
- Ensuring data quality without repeated LLM inference

### Agent Modes

Stagehand supports different execution modes that determine how the agent interacts with the browser:

**1. `dom` Mode (Default - Used Throughout This Repository)**
- Agent reasons about and interacts with the DOM tree
- Uses CSS selectors, XPath, and natural language to identify elements
- Best for: Standard web applications with interactive elements
- Example: Clicking buttons, filling forms, scraping tables
```javascript
const agent = stagehand.agent({
  mode: "dom",  // Default
  model: "azure/gpt-4o-mini"
});
```

**2. `cua` Mode (Computer Use Agent - Advanced)**
- Agent takes screenshots and reasons about pixel-level interactions
- Uses computer vision to understand UI (similar to Claude Computer Use)
- Best for: Complex layouts, non-standard UI, visual reasoning tasks
- Trade-offs: Slower, higher cost (includes vision inference)
```javascript
const agent = stagehand.agent({
  mode: "cua",
  model: "google/gemini-2.5-computer-use-preview"  // Must support vision
});
```

**Mode Comparison:**

| Feature | `dom` | `cua` |
|---------|-------|-------|
| Speed | Fast | Slower (vision inference) |
| UI Understanding | HTML/selectors | Visual/screenshot-based |
| Best For | Standard web apps | Complex/visual UI |
| Cost | Lower | Higher |
| Model Support | All LLMs | Vision-capable only |
| Accessibility | Tree-based | Pixel-based |
| Browser Compatibility | Playwright | Chrome, Edge |

**When to Use Each Mode:**

Use **`dom` mode** (default) for:
- Typical websites with semantic HTML
- Form filling and clicking
- Table and list extraction
- Standard e-commerce sites, news sites, blogs

Use **`cua` mode** for:
- Heavily styled/customized UIs
- Canvas-based applications
- PDF viewers, image editors
- Sites with complex drag-and-drop
- When HTML structure is not representative

### Mode Selection in This Repository

All scripts in this repository use **`dom` mode** by default:
```javascript
// From tests/agentic/azure/azure_agent_scraper.js
const agent = stagehand.agent({
  model: "azure/gpt-4o-mini",
  systemPrompt: `You are an expert web scraping agent...`,
  mode: "dom"  // Standard DOM-based reasoning
});
```

To switch to `cua` mode, simply change the mode and ensure your model supports vision:
```javascript
const agent = stagehand.agent({
  mode: "cua",  // Computer Use Agent mode
  model: "google/gemini-2.5-computer-use-preview"  // Vision-capable model
});
```

### Determinism and Reliability Strategy

The examples in this repository follow the Stagehand philosophy for production-grade scraping:
* **Hybrid Execution:** Deterministic Playwright-like navigation handles known boundaries, while Stagehand handles unknown or drift-prone extractions. Combine `page.goto()` with `extract()` for best results.
* **Schema Validation:** Always using Zod schemas (`extract` and `agent.execute` outputs) to ensure AI hallucinations fail fast instead of creating silent data drift. Schemas act as a contract between agent and consumer.
* **Agent Guardrails:** Complex agent workflows are bounded by explicit system prompts, step limits (`maxSteps`), and custom tool boundaries to maintain operational control.
* **Action Caching:** Stagehand caches observed/executed actions for replay efficiency. First run discovers workflow steps; subsequent runs replay with minimal inference.
* **Explicit Step Limits:** Always set `maxSteps` to prevent infinite loops. Typical range: 10-50 steps depending on complexity.

---

## Project Layout

Key folders and files demonstrating the Stagehand architecture:

### Main Scripts
- **`main/scraper.js`:** Production-ready autonomous scraper with intelligent extraction, SearXNG search integration, and modular architecture. Supports both URL-based and search-based scraping.
- **`index.js`:** Baseline Stagehand primitive tests (`observe`, `act`, `extract`) connected to Lightpanda via CDP. Good starting point for understanding primitives.

### Modular Library Structure
- **`lib/agent/`:** Agent configuration and browser setup
  - `agentConfig.js` — Agent system prompts and configuration
  - `browserSetup.js` — Lightpanda/browser initialization
- **`lib/tools/`:** Reusable agent tools
  - `searchTool.js` — SearXNG search integration
  - `pageAnalysisTool.js` — Page structure analysis
  - `schemaGenerationTool.js` — CSS schema generation with LLM
  - `schemaExtractionTool.js` — Data extraction using CSS schemas
- **`lib/utils/`:** Utility functions
  - `cliUtils.js` — Command-line argument parsing
  - `logUtils.js` — Colored console logging
  - `resultsManager.js` — Results saving and display
- **`lib/generateSchemaUtil.js`:** CSS schema generation utilities with validation, confidence scoring, and caching
- **`lib/searchUrls.js`:** SearXNG search API wrapper
- **`lib/NvidiaOpenAIWrapper.js`:** OpenAI-compatible response-cleaning wrapper to adapt NVIDIA NIM for Stagehand's expected payload schemas

### Legacy Examples (Old Structure)
- **`old/tests/agentic/azure/`:** Advanced multi-step agent scraping utilizing the `stagehand.agent()` API
  - `azure_agent_scraper.js` — Single-page scraping with full agent autonomy
  - `azure_pagination_agent.js` — Multi-page pagination handled inside agent loop
  - `azure_hybrid_scraper.js` — Azure for reasoning, NVIDIA for execution (cost-optimized)
  - `azure_scraper_with_tools.js` — Custom tools (filter, sort, deduplicate) available to agent

### Research & Documentation
- **`docs/`:** Comprehensive documentation and research notes
  - Architecture deep dives (Stagehand, Lightpanda)
  - Context7 research and API references
  - Agent patterns and scraping guides
  - Setup guides and troubleshooting
- **`deep-dive/`:** AntiVibe-style deep dive documentation for learning

## Setup & Requirements

- Node.js 18+ and `npm`
- API credentials configured in `.env`
- **Browser engine (choose one):**
  - **Built-in browser** (default, requires no setup)
  - **Lightpanda** (optional, local CDP server)
  - **Remote service** (e.g., Browserbase)

### Install Dependencies

```bash
npm install
```

### Optional: Download Lightpanda

Only needed if you prefer local Lightpanda instead of the built-in browser:

```bash
curl -L -o lightpanda https://github.com/lightpanda-io/browser/releases/download/nightly/lightpanda-x86_64-linux
chmod +x lightpanda
```

## Browser Configuration Options

### 1. Built-In Browser (Recommended for Quick Start)
Stagehand includes a built-in browser engine—**no setup required**. Most scripts use this by default:

```javascript
const stagehand = new Stagehand();
// Uses built-in browser automatically
await stagehand.init();
```

### 2. Lightpanda CDP Server (Local Development)
Optional. Useful for debugging or if you prefer local control. Start in a separate terminal:

```bash
./scripts/start_lightpanda.sh
```

Then connect via:
```javascript
const stagehand = new Stagehand({
  browserClient: new PlaywrightClient({ 
    browserWSEndpoint: "ws://localhost:9222" // Lightpanda CDP
  })
});
```

### 3. Remote Browser Service (Production)
For scalable production, use services like Browserbase:

```javascript
const stagehand = new Stagehand({
  browserClient: new PlaywrightClient({ 
    browserWSEndpoint: browserBaseWsEndpoint // From Browserbase API
  })
});
```

## Environment Variables

Copy `.env.example` to `.env` (or create it) and populate based on your LLM choice:

**For NVIDIA NIM workflows:**
```env
NVIDIA_API_KEY=your_key_here
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
```

**For Azure OpenAI powered agents:**
```env
AZURE_OPENAI_API_KEY=your_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
```

## Quick Start & Examples

### For Learning Stagehand Concepts

1. **Start with primitives:** Review `tests/basic/` for `observe`, `act`, `extract` examples
2. **Run the baseline:** `npm start` — executes a single-page extraction
3. **Read architecture docs:** See `docs/STAGEHAND_ARCHITECTURE_DEEP_DIVE.md`
4. **Experiment:** Modify scripts in `tests/` and test different models/prompts

### For Building Production Scrapers

1. **Choose your browser:** Built-in (easy), Lightpanda (local control), or remote service (scalable)
2. **Set up LLM:** Configure `.env` with Azure OpenAI or NVIDIA NIM keys
3. **Start with agent examples:** See `tests/agentic/` for multi-step scraping patterns
4. **Add tools for post-processing:** Use `filterData`, `sortData`, etc. (see `azure_scraper_with_tools.js`)
5. **Implement error handling:** Reference troubleshooting section for common issues
6. **Monitor costs:** Track token usage and set `maxSteps` limits

### For Integrating into Your Application

1. **Use as a module:** Import Stagehand and wrap it in your application logic
2. **Create wrapper functions:** Encapsulate scraping tasks in reusable functions
3. **Add request queuing:** Use Bull or similar for large-scale scraping
4. **Implement caching:** Store page snapshots and action sequences locally
5. **Set up logging:** Use structured logging (Winston, Pino) for observability

Example integration pattern:
```javascript
// scraper-service.js
import { Stagehand } from "@browserbase/stagehand";

export async function scrapeProductData(url, productSchema) {
  const stagehand = new Stagehand();
  try {
    await stagehand.init();
    const products = await stagehand.extract(
      "Extract all product listings",
      productSchema
    );
    return { success: true, data: products };
  } catch (error) {
    logger.error("Scrape failed", { url, error });
    throw error;
  } finally {
    await stagehand.close();
  }
}
```

### AI-Powered Scraper (NEW - Refactored & Modular)

**Production-ready autonomous scraper** with intelligent extraction and modular architecture:

```bash
# Search and scrape (uses SearXNG - no URL needed)
node main/scraper.js \
  --prompt "Find 3 Python tutorial websites" \
  --steps 30

# Direct URL scraping with intelligent extraction
node main/scraper.js \
  --url "http://books.toscrape.com" \
  --prompt "Extract all books with title, price, and rating" \
  --steps 50

# Short form
node main/scraper.js \
  -p "Find JavaScript frameworks and extract their features" \
  -s 40
```

**Features:**
- ✅ **Modular architecture** — Clean separation of concerns (tools, agent, utils)
- ✅ **Intelligent extraction** — Analyzes page structure and chooses optimal strategy
- ✅ **Schema-based extraction** — Cost-effective CSS extraction with LLM-generated schemas
- ✅ **Schema caching** — Reuses schemas across pages (instant, $0 cost)
- ✅ **Autonomous web search** — SearXNG integration for search-based scraping
- ✅ **Incremental saving** — Saves data progressively during extraction
- ✅ **Multi-page pagination** — Automatic pagination handling
- ✅ **Confidence scoring** — Validates extraction quality

**Command-Line Arguments:**
- `-p, --prompt <text>` — Task description (required)
- `-u, --url <url>` — Specific URL to scrape (optional, uses search if omitted)
- `-s, --steps <number>` — Max agent steps (default: 50)
- `-h, --help` — Show help message

**Requirements:**
- Azure OpenAI credentials (for agent reasoning)
- Lightpanda running on port 9222 (or built-in browser)
- SearXNG instance (default: `http://localhost:8888`) for search-based scraping

**Architecture:**
The scraper uses a modular design with reusable components:
- **Tools** — Page analysis, schema generation, schema extraction, search
- **Agent** — Configuration and browser setup
- **Utils** — CLI parsing, logging, results management

## Workflow Execution Flow

Typical Stagehand automation flow in this repository:

```
1. Initialize Stagehand → Uses built-in browser (or Lightpanda if configured)
2. Navigate to target page → page.goto(url)
3. Choose strategy:
   ├─ Simple: observe() → act() → extract()
   ├─ Complex: agent.execute() with system prompt
   └─ Custom: manual think-observe-act loop
4. Apply schema validation (Zod)
5. Collect metrics/history
6. Save results to JSON
7. Close session
```

## Quick Start & Examples

### 1. Run Stagehand Scripts (Using Built-In Browser)

**No setup required.** The built-in browser starts automatically:

### 2. Run Stagehand Scripts

**Baseline Primitives (Start Here) — Uses Built-In Browser:**
Experiment with `observe`, `act`, `extract` directly:
```bash
npm start  # Runs index.js (automatically uses built-in browser)
```

**Azure Autonomous Scraper:**
Executes an open-ended search and extraction via Google. Interactive prompts guide the task.
```bash
node tests/agentic/azure_autonomous_scraper.js
```

**AI-Powered Scraper (Recommended - Refactored):**
Production-ready modular scraper with intelligent extraction, schema generation, and SearXNG search integration.

```bash
# Search and scrape (no URL needed)
node main/scraper.js \
  --prompt "Find top 10 Python tutorials with links and descriptions" \
  --steps 40

# Direct URL scraping with intelligent extraction
node main/scraper.js \
  --url "http://books.toscrape.com" \
  --prompt "Scrape 60 books with title, price, rating, and availability" \
  --steps 60

# Short form
node main/scraper.js \
  -p "Find Python tutorials" \
  -s 30
```

**Command-Line Arguments:**
- `-p, --prompt <text>` — Task description (required)
- `-u, --url <url>` — Optional specific URL (for direct scraping)
- `-s, --steps <number>` — Max steps for agent (default: 50)
- `-h, --help` — Show help message

**Key Features:**
- ✅ **Modular architecture** — Reusable tools, agent config, and utilities
- ✅ **Intelligent extraction** — Analyzes page and chooses optimal strategy
- ✅ **Schema generation** — LLM generates CSS schemas for cost-effective extraction
- ✅ **Schema caching** — Reuses schemas across pages (instant, $0 cost)
- ✅ **SearXNG search** — Privacy-focused search without API keys
- ✅ **Multi-page pagination** — Automatic pagination handling
- ✅ **Incremental saving** — Progressive data saving during extraction
- ✅ **Confidence scoring** — Validates extraction quality

**Example Use Cases:**
```bash
# E-commerce scraping with intelligent extraction
node main/scraper.js \
  --url "http://books.toscrape.com" \
  -p "Extract all books with title, price, and rating" \
  -s 50

# Search-based scraping
node main/scraper.js \
  -p "Find latest AI news articles from tech news sites" \
  -s 35

# Multi-page product scraping
node main/scraper.js \
  --url "https://example.com/products" \
  -p "Scrape 100 products across all pages" \
  -s 80
```

**Targeted Pagination Agent:**
Uses the Stagehand `agent()` subsystem to handle multi-page layout traversal. Agent internally manages pagination logic.
```bash
node tests/agentic/azure/azure_pagination_agent.js "Scrape 50 stories" "https://news.ycombinator.com" 3 50
```
Parameters: `"<task>" "<url>" <maxPages> <maxSteps>`

**Hybrid Agent Architecture:**
Utilizes Azure for reasoning (the cognitive planner) and NVIDIA NIM for executing `act`/`extract` primitives. Most cost-efficient for large-scale scraping.
```bash
node tests/agentic/azure/azure_hybrid_scraper.js "Scrape 50 stories" "https://news.ycombinator.com" 30
```

**Interactive Scraper with Custom Tools:**
Agent has access to data processing tools (filter, sort, deduplicate). Prompts ask for task/pagination/processing preferences.
```bash
node tests/agentic/azure_scraper_with_tools.js
```

### 3. Optional: Use Lightpanda Instead of Built-In Browser

If you want local CDP debugging or prefer Lightpanda, start it in a separate terminal:
```bash
./scripts/start_lightpanda.sh
curl http://127.0.0.1:9222/json/version  # Verify it's running
```

Then modify your scripts to point to Lightpanda (see Browser Configuration section above).

### 4. Advanced: Custom Reasoning Loop
Manually orchestrate think-observe-act cycles. Useful for implementing custom decision logic.
```bash
node tests/reasoning_agent_scraper.js "Get 30 stories" "https://news.ycombinator.com" 10
```

## Stagehand Agent Lifecycle

When you call `agent.execute()`, Stagehand performs the following loop (up to `maxSteps`):

```
Loop iteration:
  1. Observe: Query LLM about current page state
  2. Reason: LLM decides next action (act, extract, navigate, or stop)
  3. Execute: Perform action on page or extract data
  4. Evaluate: Check if task is complete or hit stopping condition
Until: task complete OR maxSteps reached OR no progress
```

The system prompt you provide influences all reasoning decisions. Pagination, filtering, and stopping logic should be explicit in the system prompt for predictable behavior.

## Use Cases & Patterns

### Single-Page Extraction
Best for homogeneous data on one page:
```javascript
const data = await stagehand.extract(
  "Extract all product titles and prices",
  ProductSchema
);
```

### Multi-Page Pagination
Use agent for automatic pagination handling:
```javascript
const result = await agent.execute({
  instruction: "Scrape products from pages 1-5. Use pagination buttons to advance.",
  maxSteps: 50,
  output: z.object({ products: z.array(ProductSchema) })
});
```

### Search-Then-Scrape
Start from Google, autonomously find target site:
```javascript
await page.goto('https://www.google.com');
const result = await agent.execute({
  instruction: "Search for 'best nodejs frameworks', visit top result, extract frameworks list",
  maxSteps: 40,
  output: FrameworkListSchema
});
```

### Cost-Optimized Extraction
Use cheaper model for inference, keep expensive model for reasoning:
```javascript
const hybrid = new Stagehand({
  llmClient: new CustomOpenAIClient({ // NVIDIA NIM (cheap extract/act)
    modelName: "meta/llama-3.1-8b",
    client: nvidiaOpenAI
  })
});
const agent = hybrid.agent({
  model: "azure/gpt-4o-mini" // Azure (expensive reasoning)
});
```

### Agent with Custom Tools (Data Processing)
Equip agent with tools for filtering, sorting, and deduplication:
```javascript
const customTools = {
  filterByPrice: tool({
    description: "Filter products by price range",
    parameters: z.object({
      items: z.array(z.object({ price: z.number() })),
      maxPrice: z.number()
    }),
    execute: async ({ items, maxPrice }) => {
      return items.filter(item => item.price <= maxPrice);
    }
  }),
  deduplicateByTitle: tool({
    description: "Remove duplicate products by title",
    parameters: z.object({ items: z.array(z.object({ title: z.string() })) }),
    execute: async ({ items }) => {
      const seen = new Set();
      return items.filter(item => {
        if (seen.has(item.title)) return false;
        seen.add(item.title);
        return true;
      });
    }
  })
};

const result = await agent.execute({
  instruction: "Scrape products, filter under $100, and remove duplicates",
  maxSteps: 40,
  output: z.object({ products: z.array(ProductSchema) }),
  tools: customTools  // Make tools available to agent
});
```

### Complex UI Interaction (CUA Mode)
Use Computer Use Agent mode for pixel-level visual reasoning:
```javascript
const agent = stagehand.agent({
  mode: "cua",  // Computer Use Agent mode (vision-based)
  model: "google/gemini-2.5-computer-use-preview"
});

const result = await agent.execute({
  instruction: "Interact with the visual website layout, click drag elements, extract visual data",
  maxSteps: 50
});
```

### Streaming Results
Get real-time feedback as agent executes:
```javascript
const agentRun = await agent.execute({
  instruction: "Scrape data with progress updates",
  maxSteps: 30,
  stream: true  // Enable streaming
});

for await (const event of agentRun.eventStream) {
  console.log("Agent step:", event.type, event.description);
}

const finalResult = await agentRun.result;
```

## Troubleshooting Stagehand

**Unresponsive Browser:**
- If using built-in browser: Restart the script (browser session ends when script closes)
- If using Lightpanda: Verify it's running:
```bash
curl http://127.0.0.1:9222/json/version
ps aux | grep lightpanda
./scripts/start_lightpanda.sh  # Restart
```
- If using remote service (Browserbase): Check your API key and service status

**Data Shape Errors (Schema Validation):**
- Symptom: `Failed to parse model response as JSON` or schema mismatch
- Cause: Model output doesn't match Zod schema. Smaller models (like Llama-3.1) have trouble with complex schemas.
- Solution: Simplify schema or use stronger model (GPT-4). Test schema against model output separately.

**Infinite Agent Loops:**
- Symptom: Agent keeps running, token costs spike
- Cause: No clear stopping condition or `maxSteps` too high
- Solution: Set explicit `maxSteps` (typical: 20-50). Add stopping criteria to system prompt (e.g., "Stop when you have 50 items or no more pages").

**NVIDIA NIM Response Parsing:**
- Symptom: Stagehand rejects NVIDIA responses as invalid JSON
- Cause: NVIDIA NIM sometimes returns schema + data combined
- Solution: Use `NvidiaOpenAIWrapper` from `lib/` which automatically cleans responses.

**Model Authentication:**
- Symptom: 401 Unauthorized or invalid credentials
- Cause: `.env` variables missing or incorrect
- Solution: Verify `.env` has correct keys. For Azure, check endpoint format (should include `openai.azure.com`).

**Browser Timeout:**
- Symptom: Operations hang or timeout
- Cause: Page loading slowly or infinite scroll
- Solution: Set page timeout: `await page.goto(url, { timeout: 30000 })`. Add step timeouts in agent config.

**Tool Not Invoked by Agent:**
- Symptom: Agent has access to tools but never calls them
- Cause: System prompt doesn't mention tool availability or tool descriptions are unclear
- Solution: Explicitly mention tools in system prompt. Make descriptions action-oriented (e.g., "You can use filterData to remove expensive items").
```javascript
const systemPrompt = `...You have access to these tools: filterData (remove items), sortData (order items), deduplicateData (remove duplicates). Use them to process results after extraction...`;
```

**Mode Selection Error:**
- Symptom: `Error: Mode 'cua' requires vision-capable model` or model doesn't work with chosen mode
- Cause: Using CUA mode with a model that doesn't support vision, or DOM mode with vision model
- Solution: Match model to mode. CUA mode requires: `google/gemini-2.5-computer-use-preview`, `claude-computer-use`, or similar vision models. DOM mode works with any LLM.

**Poor Tool Execution Quality:**
- Symptom: Tools are called but produce incorrect or incomplete results
- Cause: Tool parameter schema is too complex or tool logic has edge cases
- Solution: Test tool implementations independently. Use simple, deterministic logic in tools. Validate tool inputs with strict Zod schemas.

**Built-In Browser Not Initializing:**
- Symptom: Error like "Browser launch failed" or "CDP connection timeout"
- Cause: Port in use, insufficient system resources, or missing browser binary
- Solution: (1) Check no other Stagehand instances are running. (2) Ensure 512MB+ free memory. (3) Try explicit browser config in Stagehand init.

**Lightpanda CDP Connection Failed:**
- Symptom: `Error: Cannot connect to ws://localhost:9222`
- Cause: Lightpanda not started or not running on expected port
- Solution: (1) Start Lightpanda with `./scripts/start_lightpanda.sh`. (2) Verify with `curl http://127.0.0.1:9222/json/version`. (3) Check port not in use: `lsof -i :9222`.

## Production Deployment Considerations

### Environment Isolation
- Use separate `.env` files for staging and production (e.g., `.env.prod`, `.env.staging`)
- Maintain separate cache directories (Stagehand caches observed actions) per environment
- Pin specific model versions to avoid surprise behavior changes

### Observability & Monitoring
- Enable `verbose: 2` in development; use `verbose: 0` or structured logging in production
- Capture agent execution metrics: total steps taken, tokens used, extraction success rate
- Log failures to centralized platform (e.g., Sentry, DataDog) with full execution history
- Set up alerts for runaway costs (e.g., `maxSteps` exceeded repeatedly)

### Error Handling & Retries
- Implement retry logic at the workflow level (e.g., 3 attempts with exponential backoff)
- Log detailed failure context: URL, task, last observed page state, agent reasoning
- Use separate schema validation in a post-processing pipeline to catch edge cases

### Scalability
- For high volume: Use Lightpanda in remote/hosted mode (e.g., Browserbase) instead of local CDP
- Deploy Stagehand wrappers as stateless functions/Lambda to enable horizontal scaling
- Batch similar tasks and reuse cached actions when possible (Stagehand's caching engine)

### Cost Optimization
- Use hybrid agent setup: cheaper model for `extract`/`act`, stronger model for reasoning
- Monitor token usage per task. Implement thresholds to abort runaway extractions
- Cache page snapshots and action sequences to reduce repeated inference
- Schedule large scraping jobs during off-peak hours to benefit from rate limits

## Performance Tips

| Operation | Optimization |
|-----------|--------------|
| **observe** | Use minimal task descriptions. Avoid vague instructions like \"find elements\". Be specific. |
| **act** | Prefer action objects from `observe()` over repeated natural language; reduces LLM calls. |
| **extract** | Keep Zod schemas simple. Complex nested schemas slow parsing and increase hallucination risk. |
| **agent** | Set `maxSteps` based on expected task complexity. Start at 20, increase if needed. |
| **pagination** | Explicitly teach agent pagination boundaries in system prompt. Avoids infinite scrolling. |
| **models** | Llama-3.1 8B: fast but limited reasoning. GPT-4o mini: best for complex multi-step tasks. |

## Getting Help

- **Stagehand Docs:** https://docs.stagehand.dev (official docs, best practices, API reference)
- **Architecture Deep Dive:** See `docs/STAGEHAND_ARCHITECTURE_DEEP_DIVE.md` in this repo
- **Research Notes:** See `docs/STAGEHAND_CONTEXT7_RESEARCH.md` for Context7-extracted API reference
- **GitHub Issues:** https://github.com/browserbase/stagehand for framework bugs/feature requests
- **Examples:** Review `tests/agentic/` and `tests/pagination/` for pattern examples

## Key Takeaways

1. **Use Stagehand primitives** (`observe`, `act`, `extract`) for fine-grained control; use `agent` for complex workflows
2. **Always validate output** with Zod schemas—they're your safety layer against AI errors
3. **Set `maxSteps` explicitly**—default is 20; increase based on task complexity and cost tolerance
4. **Combine with deterministic code**—use Playwright navigation, Stagehand for semantic understanding
5. **Monitor costs**—track tokens, implement alerts, use hybrid setups for at-scale operations
6. **Leverage tools for post-processing**—don't rely solely on LLM for data filtering/sorting; use deterministic tools
7. **Choose the right mode**—use `dom` mode (default, fast) for standard sites; use `cua` mode only when visual reasoning is needed

## Modular Architecture Benefits

The refactored scraper (`main/scraper.js`) demonstrates production-ready patterns:

### Separation of Concerns
- **Tools** (`lib/tools/`) — Reusable agent capabilities (search, analysis, extraction)
- **Agent** (`lib/agent/`) — Configuration and browser management
- **Utils** (`lib/utils/`) — CLI, logging, results handling

### Reusability
Each module can be imported and used independently:
```javascript
import { createSearchTool } from './lib/tools/searchTool.js';
import { createPageAnalysisTool } from './lib/tools/pageAnalysisTool.js';
import { initializeBrowser } from './lib/agent/browserSetup.js';

// Use in your own scripts
const { stagehand, page } = await initializeBrowser();
const searchTool = createSearchTool();
```

### Maintainability
- **Single responsibility** — Each file has one clear purpose
- **Easy testing** — Test tools and utilities independently
- **Clear dependencies** — Import paths show relationships
- **Scalable** — Add new tools without modifying existing code

### Example: Adding a Custom Tool
```javascript
// lib/tools/myCustomTool.js
import { tool } from "@browserbasehq/stagehand";
import { z } from "zod";

export function createMyCustomTool(page) {
  return tool({
    description: "My custom functionality",
    inputSchema: z.object({ /* ... */ }),
    execute: async (params) => { /* ... */ }
  });
}

// main/scraper.js
import { createMyCustomTool } from '../lib/tools/myCustomTool.js';
// Add to tools object
tools.myCustom = createMyCustomTool(page);
```

---

**Last Updated:** May 10, 2026  
**Stagehand Version:** ~3.0  
**Node Version:** 18+  
**Architecture:** Modular (Refactored May 2026)

