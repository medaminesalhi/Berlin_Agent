# Docker Setup for AI-Powered Scraper

This folder contains Docker Compose configurations for running the infrastructure needed by the AI-powered scraper:
- **SearXNG** - Privacy-focused search engine for autonomous web search
- **Lightpanda** - Lightweight browser engine for web automation

## Files

- **docker-compose.yml** - Docker Compose configuration for SearXNG and Lightpanda
- **settings.yml** - SearXNG settings with JSON format enabled

## Quick Start

### Start All Services

From this directory:

```bash
# Start SearXNG and Lightpanda
docker compose up -d

# Verify SearXNG is running
curl "http://localhost:8888/search?q=test&format=json"

# Verify Lightpanda is running
curl http://localhost:9222/json/version

# Check service status
docker compose ps
```

### Run the Scraper

From project root:

```bash
# Search-based scraping (uses SearXNG)
node main/scraper.js \
  --prompt "Find Python tutorials" \
  --steps 30

# Direct URL scraping (uses Lightpanda)
node main/scraper.js \
  --url "http://books.toscrape.com" \
  --prompt "Extract books with title and price" \
  --steps 50
```

### Stop Services

```bash
# Stop all services
docker compose down

# Stop and remove volumes
docker compose down -v
```

## Service Configuration

### SearXNG (Search Engine)
- **Port**: 8888
- **Formats Enabled**: HTML, JSON
- **Bind Address**: 127.0.0.1 (localhost only)
- **Purpose**: Privacy-focused web search for autonomous scraping
- **Used by**: `lib/tools/searchTool.js`

### Lightpanda (Browser Engine)
- **Port**: 9222 (Chrome DevTools Protocol)
- **Idle Timeout**: 3600 seconds (1 hour)
- **DNS Servers**: 8.8.8.8, 8.8.4.4 (Google DNS)
- **Purpose**: Lightweight browser for web automation
- **Used by**: `lib/agent/browserSetup.js`

## Environment Variables

Set these in your `.env` file (project root):

```env
# SearXNG Configuration
SEARXNG_URL=http://localhost:8888

# Lightpanda Configuration
LIGHTPANDA_CDP_URL=ws://localhost:9222

# Azure OpenAI (required for scraper)
AZURE_API_KEY=your_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
```

## Troubleshooting

### SearXNG Not Responding
```bash
# Check logs
docker compose logs searxng

# Restart service
docker compose restart searxng

# Test manually
curl "http://localhost:8888/search?q=test&format=json"
```

### Lightpanda Connection Failed
```bash
# Check logs
docker compose logs lightpanda

# Verify CDP endpoint
curl http://localhost:9222/json/version

# Restart service
docker compose restart lightpanda
```

### Port Already in Use
```bash
# Check what's using the port
lsof -i :8888  # SearXNG
lsof -i :9222  # Lightpanda

# Kill the process or change port in docker-compose.yml
```

### DNS Resolution Issues (Lightpanda)
If Lightpanda can't resolve domains, the configuration already includes Google DNS (8.8.8.8, 8.8.4.4). If issues persist:

```bash
# Check DNS configuration
docker compose exec lightpanda cat /etc/resolv.conf

# Restart with fresh DNS
docker compose down
docker compose up -d
```

## Production Deployment

### Make SearXNG Accessible Externally

Edit `settings.yml`:

```yaml
server:
  bind_address: "0.0.0.0"  # Changed from "127.0.0.1"
```

Then restart:

```bash
docker compose restart searxng
```

### Security Considerations

For production deployments:

1. **Use authentication** - Add API keys or basic auth to SearXNG
2. **Firewall rules** - Restrict access to trusted IPs
3. **HTTPS/TLS** - Use reverse proxy (nginx, Caddy) with SSL
4. **Rate limiting** - Prevent abuse with request limits
5. **Monitoring** - Set up health checks and alerts

### Resource Limits

The docker-compose.yml includes resource limits:
- **SearXNG**: 512MB memory, 1 CPU
- **Lightpanda**: 1GB memory, 2 CPUs

Adjust based on your workload:

```yaml
services:
  searxng:
    deploy:
      resources:
        limits:
          memory: 1G  # Increase for heavy usage
          cpus: '2'
```

## Integration with Scraper

The scraper automatically uses these services:

```javascript
// lib/tools/searchTool.js uses SearXNG
const result = await searchUrls(query, maxResults);

// lib/agent/browserSetup.js uses Lightpanda
const cdpUrl = process.env.LIGHTPANDA_CDP_URL || "ws://127.0.0.1:9222";
```

No additional configuration needed if services are running on default ports.

---

**Last Updated**: May 10, 2026  
**Docker Compose Version**: v2  
**Services**: SearXNG 2024.x, Lightpanda (nightly)
