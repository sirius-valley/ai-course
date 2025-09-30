import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { load } from "cheerio";

type CrawlResult = {
  fetchedUrls: string[];
  savedFiles: string[];
};

const START_URL = "https://ffmpeg.org/ffmpeg.html";
const OUTPUT_DIR = path.resolve(process.cwd(), "data/ffmpeg-docs");

// Only follow top-level ffmpeg docs pages like ffmpeg.html, ffmpeg-utils.html, download.html, etc.
const isAllowedDocsUrl = (url: URL): boolean => {
  const isSameHost = url.hostname === "ffmpeg.org" || url.hostname === "www.ffmpeg.org";
  if (!isSameHost) return false;
  // Keep only /ffmpeg*.html pages and /download.html
  return /^\/(ffmpeg[^/]*|download)\.html$/.test(url.pathname);
};

const normalizeUrl = (raw: string): string => {
  const u = new URL(raw);
  u.hash = ""; // drop anchors
  u.search = ""; // drop queries
  return u.toString();
};

const toFilename = (u: URL): string => {
  const base = path.basename(u.pathname);
  return base.length > 0 ? base : "ffmpeg.html";
};

const ensureOutputDir = async (): Promise<void> => {
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }
};

const fetchHtml = async (url: string): Promise<string> => {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return await res.text();
};

const extractLinks = (html: string, baseUrl: string): string[] => {
  const $ = load(html);
  const out: string[] = [];
  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const abs = new URL(href, baseUrl);
      if (isAllowedDocsUrl(abs)) {
        out.push(normalizeUrl(abs.toString()));
      }
    } catch {
      // ignore invalid URLs
    }
  });
  return Array.from(new Set(out));
};

const saveHtml = async (u: URL, html: string): Promise<string> => {
  const file = path.join(OUTPUT_DIR, toFilename(u));
  await writeFile(file, html, "utf8");
  return file;
};

const writeIndex = async (urls: string[]): Promise<void> => {
  const indexPath = path.join(OUTPUT_DIR, "index.json");
  const payload = { seed: START_URL, fetched: urls };
  await writeFile(indexPath, JSON.stringify(payload, null, 2), "utf8");
};

async function crawl(seedUrl: string): Promise<CrawlResult> {
  await ensureOutputDir();

  const queue: string[] = [normalizeUrl(seedUrl)];
  const visited: Set<string> = new Set();
  const fetchedUrls: string[] = [];
  const savedFiles: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    const currentUrl = new URL(current);
    if (!isAllowedDocsUrl(currentUrl)) continue;

    try {
      const html = await fetchHtml(current);
      const file = await saveHtml(currentUrl, html);
      fetchedUrls.push(current);
      savedFiles.push(file);

      const links = extractLinks(html, current);
      for (const link of links) {
        if (!visited.has(link)) queue.push(link);
      }
    } catch (err) {
      // Best-effort crawler: log and continue
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[crawl] ${message}`);
    }
  }

  await writeIndex(fetchedUrls);
  return { fetchedUrls, savedFiles };
}

(async () => {
  try {
    // If index exists, resume from it to avoid re-fetching everything
    const indexPath = path.join(OUTPUT_DIR, "index.json");
    if (existsSync(indexPath)) {
      try {
        const json = JSON.parse(await readFile(indexPath, "utf8")) as { fetched?: string[] };
        if (Array.isArray(json.fetched) && json.fetched.length > 0) {
          console.log(`[crawl] Existing index found with ${json.fetched.length} URLs. Re-crawling from seed to refresh.`);
        }
      } catch {
        // ignore malformed index
      }
    }

    const result = await crawl(START_URL);
    console.log(`[crawl] Done. Fetched ${result.fetchedUrls.length} pages.`);
    console.log(`[crawl] Files saved to ${OUTPUT_DIR}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[crawl] Failed: ${message}`);
    process.exitCode = 1;
  }
})();


