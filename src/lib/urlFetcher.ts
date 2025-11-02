import axios from 'axios';
import * as cheerio from 'cheerio';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

// Create axios instance with cookie jar support
const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

export interface UrlFetchResult {
  url: string;
  title: string;
  documents: Document[];
  contentType: 'html' | 'pdf';
  error?: string;
}

/**
 * Get browser-like headers to avoid 403 errors
 */
function getBrowserHeaders(url: string, isPdf = false): Record<string, string> {
  const urlObj = new URL(url);
  const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
  };

  if (isPdf) {
    headers['Accept'] = 'application/pdf,application/octet-stream,*/*';
  } else {
    headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';
  }

  // Add referer for better success rate
  headers['Referer'] = baseUrl;

  return headers;
}

/**
 * Retry function with exponential backoff
 * Reduced to 2 retries for faster failure
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on 404 or validation errors
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404 || error.response?.status === 400) {
          throw error;
        }
      }

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Run a function with a timeout
 * @param fn - The async function to run
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Error message if timeout occurs
 */
async function withTimeout<T>(
  fn: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    fn,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
}

/**
 * Detect if a URL points to a PDF file
 */
function isPdfUrl(url: string, contentType?: string): boolean {
  // Check URL extension
  if (url.toLowerCase().endsWith('.pdf')) {
    return true;
  }

  // Check Content-Type header
  if (contentType && contentType.toLowerCase().includes('application/pdf')) {
    return true;
  }

  return false;
}

/**
 * Download PDF from URL and process it
 */
async function fetchPdfFromUrl(url: string): Promise<UrlFetchResult> {
  console.log(`Fetching PDF from URL: ${url}`);

  try {
    // First, try to access the base URL to establish session/cookies
    const urlObj = new URL(url);
    const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;

    try {
      await client.get(baseUrl, {
        timeout: 5000,
        headers: getBrowserHeaders(baseUrl),
        maxRedirects: 5,
      });
      console.log('Established session with base URL');
    } catch {
      // Ignore errors from base URL access
      console.log('Could not access base URL, proceeding anyway');
    }

    // Download PDF with retry logic
    const response = await retryWithBackoff(async () => {
      return await client.get(url, {
        responseType: 'arraybuffer',
        timeout: 60000, // Increased to 60 seconds for large PDFs
        headers: getBrowserHeaders(url, true),
        maxRedirects: 5,
      });
    });

    // Create temp file
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `pdf_${Date.now()}.pdf`);
    await fs.writeFile(tempFile, Buffer.from(response.data));

    try {
      // Load PDF with LangChain's PDFLoader
      const loader = new PDFLoader(tempFile);
      const docs = await loader.load();

      // Extract title from first page or use domain name
      const title = extractTitleFromUrl(url);

      // Update metadata to include URL instead of file path
      const documentsWithMetadata = docs.map((doc, idx) => {
        return new Document({
          pageContent: doc.pageContent,
          metadata: {
            source: url,
            title: title,
            type: 'pdf_url',
            page: doc.metadata.loc?.pageNumber || idx + 1,
            totalPages: doc.metadata.pdf?.totalPages
          }
        });
      });

      // Split into chunks
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 8000,
        chunkOverlap: 800,
        separators: ['\n\n', '\n', ' ', '']
      });

      const chunks = await textSplitter.splitDocuments(documentsWithMetadata);

      console.log(`Successfully extracted ${chunks.length} chunks from PDF URL`);

      return {
        url,
        title,
        documents: chunks,
        contentType: 'pdf'
      };
    } finally {
      // Clean up temp file
      try {
        await fs.unlink(tempFile);
      } catch (err) {
        console.warn(`Failed to delete temp file ${tempFile}:`, err);
      }
    }
  } catch (error) {
    console.error(`Error fetching PDF from ${url}:`, error);

    // Check for 403 errors
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      throw new Error('This PDF is protected and cannot be accessed automatically. Please download it manually and upload it in the Documents tab instead.');
    }

    throw new Error(`Failed to fetch PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract title from URL (use domain + path)
 */
function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    const lastPart = pathParts[pathParts.length - 1];

    if (lastPart) {
      // Remove file extensions and clean up
      const cleanTitle = lastPart
        .replace(/\.(html|htm|pdf|php|aspx?)$/i, '')
        .replace(/[-_]/g, ' ')
        .trim();

      if (cleanTitle) {
        return cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
      }
    }

    return urlObj.hostname;
  } catch {
    return url;
  }
}

/**
 * Fetch and parse HTML content from URL
 */
async function fetchHtmlFromUrl(url: string): Promise<UrlFetchResult> {
  console.log(`Fetching HTML from URL: ${url}`);

  try {
    // Fetch the webpage with retry logic
    const response = await retryWithBackoff(async () => {
      return await client.get(url, {
        timeout: 60000, // Increased to 60 seconds for slow-loading pages
        headers: getBrowserHeaders(url),
        maxRedirects: 5,
      });
    });

    const html = response.data;

    // Use Cheerio to extract content
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $('script, style, nav, footer, aside, header, .ad, .ads, .advertisement, .social-share, .comments').remove();

    // Extract title
    const title = $('title').text().trim() ||
                  $('h1').first().text().trim() ||
                  $('meta[property="og:title"]').attr('content') ||
                  extractTitleFromUrl(url);

    // Get main content - try multiple selectors
    let content = '';
    const contentSelectors = [
      'article',
      'main',
      '.content',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.post-body',
      '#content',
      'body'
    ];

    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        content = element.text().trim();
        if (content.length > 200) {
          break; // Found good content
        }
      }
    }

    if (!content) {
      throw new Error('No content could be extracted from the webpage');
    }

    // Clean up whitespace
    content = content.replace(/\s+/g, ' ').trim();

    // Extract headings for section markers (reuse existing $ from line 251)
    const sections: { heading: string; content: string }[] = [];

    // Try to split by headings (h2, h3)
    $('h2, h3').each((_, element) => {
      const heading = $(element).text().trim();
      if (heading) {
        sections.push({ heading, content: '' });
      }
    });

    // If we found sections, split content by them
    let documents: Document[];

    if (sections.length > 0) {
      // Create documents for each section
      documents = sections.map((section, idx) => {
        return new Document({
          pageContent: content, // For now use full content
          metadata: {
            source: url,
            title: title,
            section: section.heading,
            type: 'html_url',
            sectionIndex: idx
          }
        });
      });
    } else {
      // No sections found, create single document
      documents = [
        new Document({
          pageContent: content,
          metadata: {
            source: url,
            title: title,
            type: 'html_url'
          }
        })
      ];
    }

    // Split into chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 8000,
      chunkOverlap: 800,
      separators: ['\n\n', '\n', ' ', '']
    });

    const chunks = await textSplitter.splitDocuments(documents);

    console.log(`Successfully extracted ${chunks.length} chunks from HTML URL`);

    return {
      url,
      title,
      documents: chunks,
      contentType: 'html'
    };
  } catch (error) {
    console.error(`Error fetching HTML from ${url}:`, error);

    // Check for specific error types
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 403) {
        throw new Error('This webpage is protected and blocks automated access. Please try a different URL or download the content manually.');
      }
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        throw new Error('The webpage took too long to respond. The server may be slow or blocking automated requests.');
      }
    }

    throw new Error(`Failed to fetch HTML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate URL format and security
 */
function validateUrl(url: string): void {
  try {
    const urlObj = new URL(url);

    // Only allow http and https
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Only HTTP and HTTPS URLs are allowed');
    }

    // Prevent local/internal URLs
    const hostname = urlObj.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.') ||
      hostname.endsWith('.local')
    ) {
      throw new Error('Local and internal URLs are not allowed');
    }
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Invalid URL format');
    }
    throw error;
  }
}

/**
 * Internal function to fetch content from URL
 * Automatically detects PDF vs HTML and processes accordingly
 */
async function fetchUrlContentInternal(url: string): Promise<UrlFetchResult> {
  // Validate URL
  validateUrl(url);

  console.log(`Starting URL fetch for: ${url}`);

  try {
    // First, make a HEAD request to check content type
    let contentType: string | undefined;
    try {
      const headResponse = await client.head(url, {
        timeout: 10000,
        headers: getBrowserHeaders(url),
        maxRedirects: 5,
      });
      contentType = headResponse.headers['content-type'];
    } catch {
      // HEAD request failed, will detect from URL or GET request
      console.log('HEAD request failed, will detect content type from GET request');
    }

    // Determine if it's a PDF
    if (isPdfUrl(url, contentType)) {
      return await fetchPdfFromUrl(url);
    } else {
      return await fetchHtmlFromUrl(url);
    }
  } catch (error) {
    console.error(`Failed to fetch URL ${url}:`, error);

    return {
      url,
      title: extractTitleFromUrl(url),
      documents: [],
      contentType: 'html',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Main function to fetch content from URL with timeout protection
 * Automatically detects PDF vs HTML and processes accordingly
 * @param url - The URL to fetch
 * @param timeoutMs - Maximum time to wait (default: 30 seconds)
 */
export async function fetchUrlContent(
  url: string,
  timeoutMs: number = 30000
): Promise<UrlFetchResult> {
  try {
    return await withTimeout(
      fetchUrlContentInternal(url),
      timeoutMs,
      `URL fetch timed out after ${timeoutMs / 1000} seconds. The URL may be too slow or unreachable.`
    );
  } catch (error) {
    console.error(`Fetch URL content failed for ${url}:`, error);

    // Return error result
    return {
      url,
      title: extractTitleFromUrl(url),
      documents: [],
      contentType: 'html',
      error: error instanceof Error ? error.message : 'Unknown error occurred while fetching URL'
    };
  }
}
