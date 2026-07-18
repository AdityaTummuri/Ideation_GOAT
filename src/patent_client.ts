import { settings } from './config.js';

export interface PatentResult {
  source: 'Google Patents';
  patent_number: string;
  title: string;
  url: string;
  summary: string;
  date: string;
}

export class PatentClient {
  private readonly timeout: number;

  constructor(timeout: number = 8) {
    this.timeout = timeout;
  }

  /**
   * Queries SerpApi Google Patents endpoint with retries and exponential backoff.
   */
  public async search(queryTerm: string, maxResults: number = 5, retries: number = 2): Promise<PatentResult[]> {
    const googlePatentsApiKey = settings.GOOGLE_PATENTS_API_KEY;

    // Fallback to mock results if API key is not configured
    if (!googlePatentsApiKey) {
      console.warn('GOOGLE_PATENTS_API_KEY not found. Returning mock patent results.');
      return this.getMockResults(queryTerm, maxResults);
    }

    const patents: PatentResult[] = [];

    // Prepare parameters for SerpApi
    const params = new URLSearchParams({
      engine: 'google_patents',
      q: queryTerm,
      api_key: googlePatentsApiKey,
      num: maxResults.toString()
    });

    const url = `https://serpapi.com/search?${params.toString()}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        console.warn(`Querying SerpApi Google Patents API (Attempt ${attempt + 1}/${retries + 1}): ${queryTerm}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout * 1000);

        const response = await fetch(url, {
          headers: { 'User-Agent': 'IdeationGOAT/1.2.0' },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        const responseData = (await response.ok ? response.json() : {}) as any;

        // Check for error in response
        const errorMsg = responseData.search_metadata?.error;
        if (errorMsg) {
          throw new Error(`SerpApi Error: ${errorMsg}`);
        }

        const organicResults = responseData.organic_results || [];
        for (const item of organicResults) {
          let patId = item.patent_id || 'Unknown';
          // Strip 'patent/' prefix if present
          if (patId.startsWith('patent/')) {
            const parts = patId.split('/');
            if (parts.length > 1) {
              patId = parts[1];
            }
          }

          patents.push({
            source: 'Google Patents',
            patent_number: item.publication_number || patId,
            title: item.title || 'Unknown Title',
            url: item.patent_link || `https://patents.google.com/patent/${item.patent_id || ''}`,
            summary: item.snippet || 'No summary available.',
            date: item.publication_date || 'Unknown'
          });
        }

        if (patents.length > 0) {
          return patents.slice(0, maxResults);
        }

        console.warn('No organic patent results found.');
        return this.getMockResults(queryTerm, maxResults);

      } catch (err: any) {
        console.warn(`Patent query attempt ${attempt + 1} failed: ${err.message}`);
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
        } else {
          console.error(`All patent API queries failed for term: ${queryTerm}`);
          break;
        }
      }
    }

    // Fallback to graceful unavailable message on failure
    return this.getMockResults(queryTerm, maxResults);
  }

  private getMockResults(queryTerm: string, maxResults: number): PatentResult[] {
    return [
      {
        source: 'Google Patents',
        patent_number: 'N/A',
        title: 'Patents not available',
        url: '#',
        summary: 'Patent documents are currently not available.',
        date: 'N/A'
      }
    ];
  }
}
