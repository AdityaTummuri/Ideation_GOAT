import { settings } from './config.js';

export interface ScholarPaper {
  source: 'Semantic Scholar';
  title: string;
  url: string;
  summary: string;
  citations: number;
  doi: string | null;
  is_open_access: boolean;
  pdf_url: string | null;
}

export class ScholarClient {
  private readonly timeout: number;

  constructor(timeout: number = 8) {
    this.timeout = timeout;
  }

  /**
   * Queries Semantic Scholar search endpoint and enriches open-access PDF links using Unpaywall.
   */
  public async search(queryTerm: string, maxResults: number = 5, retries: number = 2): Promise<ScholarPaper[]> {
    const formattedQuery = encodeURIComponent(queryTerm);
    const unpaywallEmail = settings.UNPAYWALL_EMAIL || 'support@ideationgoat.org';

    // Base URL for Semantic Scholar Paper Search
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${formattedQuery}&limit=${maxResults}&fields=title,abstract,authors,externalIds,openAccessPdf,citationCount`;

    const headers = { 'User-Agent': 'IdeationGOAT/1.2.0' };

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        console.warn(`Querying Semantic Scholar API (Attempt ${attempt + 1}/${retries + 1}): ${queryTerm}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout * 1000);

        const response = await fetch(url, {
          headers,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as any;
        const papers: ScholarPaper[] = [];

        const items = (data.data || []).slice(0, maxResults);
        for (const item of items) {
          const title = item.title || 'Unknown Title';
          const abstract = item.abstract || 'No abstract available.';
          const citationCount = item.citationCount || 0;
          const paperId = item.paperId;

          // Default URL is Semantic Scholar landing page
          const urlLink = paperId ? `https://www.semanticscholar.org/paper/${paperId}` : '#';

          const externalIds = item.externalIds || {};
          const doi = externalIds.DOI || null;

          let pdfUrl: string | null = null;
          let isOpenAccess = false;

          // 1. Query Unpaywall if DOI is present
          if (doi) {
            const unpaywallUrl = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${encodeURIComponent(unpaywallEmail)}`;
            try {
              console.warn(`Querying Unpaywall API for DOI ${doi}`);
              
              const upController = new AbortController();
              const upTimeoutId = setTimeout(() => upController.abort(), this.timeout * 1000);
              
              const resUp = await fetch(unpaywallUrl, {
                headers,
                signal: upController.signal
              });
              
              clearTimeout(upTimeoutId);
              
              if (resUp.ok) {
                const upData = (await resUp.json()) as any;
                isOpenAccess = upData.is_oa || false;
                if (isOpenAccess) {
                  const bestLoc = upData.best_oa_location || {};
                  pdfUrl = bestLoc.url_for_pdf || null;
                }
              }
            } catch (err: any) {
              console.warn(`Unpaywall lookup failed for DOI ${doi}: ${err.message}`);
            }
          }

          // 2. Fallback to Semantic Scholar openAccessPdf if Unpaywall failed/didn't find a PDF
          if (!pdfUrl) {
            const oaPdf = item.openAccessPdf || {};
            pdfUrl = oaPdf.url || null;
            if (pdfUrl) {
              isOpenAccess = true;
            }
          }

          // If we found an open access PDF, use it as the main URL, otherwise keep the landing page
          const finalUrl = pdfUrl || urlLink;

          papers.push({
            source: 'Semantic Scholar',
            title,
            url: finalUrl,
            summary: abstract,
            citations: citationCount,
            doi,
            is_open_access: isOpenAccess,
            pdf_url: pdfUrl
          });
        }

        return papers;
      } catch (err: any) {
        console.warn(`Semantic Scholar request failed on attempt ${attempt + 1}: ${err.message}`);
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
        } else {
          console.error(`All Semantic Scholar API queries failed for term: ${queryTerm}`);
          break;
        }
      }
    }

    // Fallback to graceful non-mock unavailable message on failure
    console.warn('Returning graceful unavailable status for Semantic Scholar.');
    return [
      {
        source: 'Semantic Scholar',
        title: 'Scholars not available',
        url: '#',
        summary: 'Academic paper metadata and open-access PDFs are currently not available.',
        citations: 0,
        doi: null,
        is_open_access: false,
        pdf_url: null
      }
    ];
  }
}
