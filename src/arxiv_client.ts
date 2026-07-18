import { settings } from './config.js';

export interface ArXivPaper {
  source: 'arXiv';
  title: string;
  url: string;
  summary: string;
  category: string;
}

export class ArXivClient {
  private readonly timeout: number;

  constructor(timeout: number = settings.ARXIV_TIMEOUT) {
    this.timeout = timeout;
  }

  /**
   * Executes a keyword search on the arXiv API with retries and exponential backoff.
   */
  public async search(queryTerm: string, maxResults: number = settings.ARXIV_MAX_RESULTS, retries: number = 2): Promise<ArXivPaper[]> {
    const formattedQuery = encodeURIComponent(queryTerm);
    const url = `http://export.arxiv.org/api/query?search_query=all:${formattedQuery}&max_results=${maxResults}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        console.warn(`Querying arXiv API (Attempt ${attempt + 1}/${retries + 1}): ${queryTerm}`);
        
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

        const xmlData = await response.text();
        return this.parseXml(xmlData);
      } catch (err: any) {
        console.warn(`arXiv request failed on attempt ${attempt + 1}: ${err.message}`);
        if (attempt < retries) {
          const sleepTime = 1500 * (attempt + 1);
          await new Promise((resolve) => setTimeout(resolve, sleepTime));
        } else {
          console.error(`All arXiv API query attempts failed for term: ${queryTerm}`);
          return [];
        }
      }
    }
    return [];
  }

  /**
   * Parses the Atom XML returned by arXiv using regex.
   */
  private parseXml(xmlData: string): ArXivPaper[] {
    const papers: ArXivPaper[] = [];
    
    // Normalize newlines and spaces to make matching easier
    const normalizedXml = xmlData.replace(/\s+/g, ' ');
    
    // Find all <entry> ... </entry> blocks
    const entryRegex = /<entry>(.*?)<\/entry>/g;
    let match;
    
    while ((match = entryRegex.exec(normalizedXml)) !== null) {
      const entryContent = match[1];
      
      // Extract title
      const titleMatch = /<title>(.*?)<\/title>/.exec(entryContent);
      let title = titleMatch ? titleMatch[1].trim() : 'Unknown Title';
      title = title.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

      // Extract summary / abstract
      const summaryMatch = /<summary>(.*?)<\/summary>/.exec(entryContent);
      let summary = summaryMatch ? summaryMatch[1].trim() : 'No abstract available.';
      summary = summary.replace(/\s+/g, ' ')
                       .replace(/&lt;/g, '<')
                       .replace(/&gt;/g, '>')
                       .replace(/&amp;/g, '&');

      // Extract url (id field)
      const idMatch = /<id>(.*?)<\/id>/.exec(entryContent);
      const url = idMatch ? idMatch[1].trim() : '#';

      // Extract category (primary category or fallback category)
      let category = '';
      const primaryCatMatch = /<arxiv:primary_category[^>]*?term=["']([^"']+)["']/.exec(entryContent);
      if (primaryCatMatch) {
        category = primaryCatMatch[1];
      } else {
        const catMatch = /<category[^>]*?term=["']([^"']+)["']/.exec(entryContent);
        if (catMatch) {
          category = catMatch[1];
        }
      }

      papers.push({
        source: 'arXiv',
        title,
        url,
        summary,
        category
      });
    }

    return papers;
  }
}
