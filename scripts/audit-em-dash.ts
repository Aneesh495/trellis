import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".pnpm-store",
  ".zig-cache"
]);

const ALLOWED_EXTENSIONS = new Set([
  ".ts",
  ".js",
  ".json",
  ".md",
  ".c",
  ".h",
  ".py",
  ".html",
  ".css",
  ".yaml",
  ".yml",
  ".sh",
  "Makefile"
]);

interface Violation {
  file: string;
  line: number;
  column: number;
  character: string;
  snippet: string;
}

const violations: Violation[] = [];

function scanDirectory(dir: string): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".gitignore" && entry.name !== ".gitattributes") {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        scanDirectory(fullPath);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (ALLOWED_EXTENSIONS.has(ext) || entry.name === "Makefile") {
        scanFile(fullPath);
      }
    }
  }
}

function scanFile(filePath: string): void {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    if (!line) continue;

    // Check for unicode em dash (\u2014)
    const emDashIdx = line.indexOf("\u2014");
    if (emDashIdx !== -1) {
      violations.push({
        file: path.relative(ROOT_DIR, filePath),
        line: lineIdx + 1,
        column: emDashIdx + 1,
        character: "\\u2014 (em dash)",
        snippet: line.trim()
      });
    }

    // Check for unicode en dash (\u2013)
    const enDashIdx = line.indexOf("\u2013");
    if (enDashIdx !== -1) {
      violations.push({
        file: path.relative(ROOT_DIR, filePath),
        line: lineIdx + 1,
        column: enDashIdx + 1,
        character: "\\u2013 (en dash)",
        snippet: line.trim()
      });
    }

    // Check for double hyphen masquerading as dash with whitespace
    const pseudoEmDashMatch = /\s-{2}\s/.exec(line);
    if (pseudoEmDashMatch && pseudoEmDashMatch.index !== undefined) {
      violations.push({
        file: path.relative(ROOT_DIR, filePath),
        line: lineIdx + 1,
        column: pseudoEmDashMatch.index + 1,
        character: "double hyphen masquerading as dash",
        snippet: line.trim()
      });
    }
  }
}

console.log("Auditing project files for prohibited em dashes and en dashes...");
scanDirectory(ROOT_DIR);

if (violations.length > 0) {
  console.error(`FAILED: Found ${violations.length} prohibited dash violations:`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}:${v.column} [${v.character}] -> "${v.snippet}"`);
  }
  process.exit(1);
} else {
  console.log("PASSED: Zero prohibited em dashes or en dashes found across all audited files.");
}
