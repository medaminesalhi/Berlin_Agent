'use strict';

const DEFAULT_INSTANCE = process.env.SEARXNG_URL || 'http://localhost:8888';

export async function searchUrls(query, maxResults = 10, instanceUrl = DEFAULT_INSTANCE) {
  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
    });
    
    const url = `${instanceUrl}/search?${params.toString()}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; searchUrls/1.0)',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${text.slice(0, 100)}`);
    }
    
    const data = await response.json();
    
    if (!data.results || !Array.isArray(data.results)) {
      return {
        success: true,
        query: query,
        count: 0,
        results: [],
      };
    }
    
    const results = data.results
      .slice(0, maxResults)
      .map(result => ({
        title: result.title || 'No title',
        url: result.url || '',
        snippet: result.content || 'No description',
      }))
      .filter(r => r.url);
    
    return {
      success: true,
      query: query,
      count: results.length,
      results: results,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      results: [],
    };
  }
}

export async function searchUrlsOnly(query, maxResults = 10, instanceUrl = DEFAULT_INSTANCE) {
  const result = await searchUrls(query, maxResults, instanceUrl);
  
  if (!result.success) {
    return {
      success: false,
      error: result.error,
      urls: [],
    };
  }
  
  const urls = result.results
    .map(r => r.url)
    .filter(url => url);
  
  return {
    success: true,
    query: query,
    count: urls.length,
    urls: urls,
  };
}

export async function searchDetailed(query, maxResults = 10, instanceUrl = DEFAULT_INSTANCE) {
  return searchUrls(query, maxResults, instanceUrl);
}
