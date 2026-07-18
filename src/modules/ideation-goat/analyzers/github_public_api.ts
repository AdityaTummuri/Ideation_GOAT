import { settings } from '../config.js';

const _CACHE: Record<string, { timestamp: number; data: any }> = {};
const CACHE_TTL_SECONDS = 3600; // 1 hour

export function getGithubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'NitroForge-Semantic-Matcher'
  };
  const token = settings.GITHUB_TOKEN;
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }
  return headers;
}

/**
 * Make a GET request to GitHub API v3 with caching and rate-limit safety.
 */
export async function makeGithubRequest(endpoint: string, params?: Record<string, any>): Promise<any> {
  let url = endpoint;
  if (!endpoint.startsWith('http')) {
    url = `https://api.github.com${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  }

  // Create cache key based on URL and sorted params
  const paramStr = params
    ? Object.keys(params)
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join('&')
    : '';
  const cacheKey = `${url}?${paramStr}`;

  const now = Date.now() / 1000;
  if (cacheKey in _CACHE) {
    const entry = _CACHE[cacheKey];
    if (now - entry.timestamp < CACHE_TTL_SECONDS) {
      return entry.data;
    }
  }

  const headers = getGithubHeaders();
  
  // Format query string
  let targetUrl = url;
  if (paramStr) {
    targetUrl += (url.includes('?') ? '&' : '?') + paramStr;
  }

  try {
    const response = await fetch(targetUrl, { headers });

    // Check rate limit specifically
    if (response.status === 403) {
      const remaining = response.headers.get('X-RateLimit-Remaining');
      if (remaining && parseInt(remaining, 10) === 0) {
        console.warn(`[WARN] GitHub API rate limit reached for ${url}`);
        if (cacheKey in _CACHE) {
          return _CACHE[cacheKey].data;
        }
        return null;
      }
    }

    if (response.status === 200) {
      const data = await response.json();
      _CACHE[cacheKey] = { timestamp: now, data };
      return data;
    } else if (response.status === 404) {
      _CACHE[cacheKey] = { timestamp: now, data: null };
      return null;
    } else {
      console.warn(`[DEBUG] GitHub API returned ${response.status} for ${url}`);
      return null;
    }
  } catch (err: any) {
    console.error(`[ERROR] Request failed for ${url}: ${err.message}`);
    if (cacheKey in _CACHE) {
      return _CACHE[cacheKey].data;
    }
    return null;
  }
}

/**
 * Extract 'owner/repo' from 'https://github.com/owner/repo' or return 'owner/repo' directly.
 */
export function parseOwnerRepo(repoFullNameOrUrl: string): string | null {
  if (!repoFullNameOrUrl) return null;
  
  const clean = repoFullNameOrUrl.trim().replace(/\/$/, '');
  
  if (clean.includes('github.com/')) {
    const parts = clean.split('github.com/').pop()?.split('/') || [];
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
  } else if (clean.includes('/') && !clean.startsWith('http')) {
    const parts = clean.split('/');
    if (parts.length === 2) {
      return `${parts[0]}/${parts[1]}`;
    }
  }
  
  return null;
}
