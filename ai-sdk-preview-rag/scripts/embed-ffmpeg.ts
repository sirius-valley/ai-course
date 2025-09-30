import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";
import { db } from "@/lib/db";
import { resources } from "@/lib/db/schema/resources";
import { embeddings as embeddingsTable } from "@/lib/db/schema/embeddings";
import { generateEmbeddings } from "@/lib/ai/embedding";

const DOCS_DIR = path.resolve(process.cwd(), "data/ffmpeg-docs");

const isHtmlFile = (name: string): boolean => name.endsWith(".html");

const cleanHtmlToText = (html: string): string => {
  const $ = load(html);
  // Remove nav/headers/footers, scripts, styles, sidebars that are not content
  $("script, style, nav, header, footer").remove();
  // Remove common non-content wrappers if present
  $(".header, .footer, .nav, .sidebar, .menu").remove();
  // Keep main content; if there's a main tag, prefer it
  const main = $("main");
  const root = main.length ? main : $("body");
  // Convert to text with basic newlines between block elements
  root.find("br").replaceWith("\n");
  root.find("p, h1, h2, h3, h4, h5, h6, li").each((_i, el) => {
    const t = $(el).text();
    $(el).text(t + "\n");
  });
  const text = root.text();
  return text
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[\t ]+/g, " ")
    .trim();
};

async function* iterHtmlFiles(dir: string): AsyncGenerator<string> {
  const files = await readdir(dir);
  for (const f of files) {
    if (!isHtmlFile(f)) continue;
    yield path.join(dir, f);
  }
}

(async () => {
  try {
    let totalPages = 0;
    let totalWords = 0;
    const startMs = Date.now();
    for await (const file of iterHtmlFiles(DOCS_DIR)) {
      console.log(`[embed] Processing: ${path.basename(file)}`);
      const html = await readFile(file, "utf8");
      const text = cleanHtmlToText(html);
      // console.log(`[embed] Text: ${text}`);
      if (!text) continue;

      const words = text.split(/\s+/).filter(Boolean).length;
      totalWords += words;

      // Insert a resource and its chunked embeddings
      const [resource] = await db.insert(resources).values({ content: text }).returning();
      console.log(`[embed] Resource: ${resource.id}`);
      const chunks = await generateEmbeddings(text);
      console.log(`[embed] Chunks: ${chunks.length}`);
      if (chunks.length > 0) {
        await db.insert(embeddingsTable).values(
          chunks.map((c) => ({ resourceId: resource.id, content: c.content, embedding: c.embedding })),
        );
      }
      totalPages += 1;
      console.log(`[embed] Embedded: ${path.basename(file)} (${chunks.length} chunks, ${words} words)`);
    }
    const elapsedMs = Date.now() - startMs;
    const elapsedSec = (elapsedMs / 1000).toFixed(2);
    console.log(`[embed] Done. Processed ${totalPages} HTML files from ${DOCS_DIR}`);
    console.log(`[embed] Summary: ${totalWords} words embedded in ${elapsedSec}s`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[embed] Failed: ${message}`);
    process.exitCode = 1;
  }
})();


