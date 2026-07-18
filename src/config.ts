import * as os from 'os';
import * as path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export class Settings {
  public static readonly CHROMA_PATH = process.env.CHROMA_PATH || './chroma_data';
  public static readonly CHROMADB_COLLECTION = process.env.CHROMADB_COLLECTION || 'github_repos';
  public static readonly ARXIV_TIMEOUT = parseInt(process.env.ARXIV_TIMEOUT || '8', 10);
  public static readonly ARXIV_MAX_RESULTS = parseInt(process.env.ARXIV_MAX_RESULTS || '10', 10);
  public static readonly GITHUB_TOKEN = process.env.GITHUB_TOKEN;

  // Cloud Vector DB & LLM Configurations
  public static readonly PINECONE_API_KEY = process.env.PINECONE_API_KEY;
  public static readonly PINECONE_ENVIRONMENT = process.env.PINECONE_ENVIRONMENT;
  public static readonly PINECONE_INDEX_URL = process.env.PINECONE_INDEX_URL;
  public static readonly SUPABASE_URL = process.env.SUPABASE_URL;
  public static readonly SUPABASE_KEY = process.env.SUPABASE_KEY;
  public static readonly GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  public static readonly OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  public static readonly GOOGLE_SCHOLAR_API_KEY = process.env.GOOGLE_SCHOLAR_API_KEY;
  public static readonly GOOGLE_PATENTS_API_KEY = process.env.GOOGLE_PATENTS_API_KEY;
  public static readonly UNPAYWALL_EMAIL = process.env.UNPAYWALL_EMAIL;

  // Security Boundary: Restricts all scaffolding writes and workspace scans to the workspace folder
  public static readonly WORKSPACE_ROOT = path.resolve(
    process.env.WORKSPACE_ROOT || process.cwd()
  );
}

export const settings = Settings;
