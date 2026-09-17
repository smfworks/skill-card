export type YamlValue =
  | string
  | number
  | boolean
  | null
  | YamlValue[]
  | { [key: string]: YamlValue };

export type YamlMap = { [key: string]: YamlValue };

export interface SplitFrontmatter {
  hasFrontmatter: boolean;
  closed: boolean;
  frontmatterRaw: string;
  body: string;
  warnings: string[];
}

export interface YamlParseResult {
  fields: YamlMap;
  warnings: string[];
}

interface YamlLine {
  indent: number;
  text: string;
  empty: boolean;
}

const KEY_RE = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/;
const FOLDED_RE = /^([A-Za-z0-9_-]+)\s*:\s*([>|])([+-])?\s*$/;
const LIST_MAP_RE = /^-\s+([A-Za-z0-9_-]+)\s*:\s*(.*)$/;
const LIST_SCALAR_RE = /^-\s+(.*)$/;
const LIST_BARE_RE = /^-\s*$/;

function indentWidth(raw: string): number {
  let n = 0;
  for (const ch of raw) {
    if (ch === " ") n += 1;
    else if (ch === "\t") n += 2;
    else break;
  }
  return n;
}

function stripInlineComment(value: string): string {
  if (!value) return value;
  if (value.startsWith('"') || value.startsWith("'")) return value;
  const hash = value.indexOf(" #");
  if (hash === -1) return value;
  return value.slice(0, hash).trimEnd();
}

export function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    if (trimmed.startsWith('"')) {
      try {
        return JSON.parse(trimmed) as string;
      } catch {
        return trimmed.slice(1, -1);
      }
    }
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed;
}

function parseScalar(raw: string): YamlValue {
  const value = unquote(stripInlineComment(raw));
  if (value === "" || value === "~" || value === "null" || value === "Null") return null;
  if (value === "true" || value === "True") return true;
  if (value === "false" || value === "False") return false;
  if (value === "[]") return [];
  if (value === "{}") return {};
  return value;
}

function tokenize(block: string): YamlLine[] {
  return block.replace(/\r\n/g, "\n").split("\n").map((raw) => {
    const indent = indentWidth(raw);
    const text = raw.slice(raw.length - raw.trimStart().length);
    return { indent, text, empty: text.trim() === "" };
  });
}

function isComment(line: YamlLine): boolean {
  return line.text.startsWith("#");
}

function skipNoise(lines: YamlLine[], index: number): number {
  let i = index;
  while (i < lines.length && (lines[i].empty || isComment(lines[i]))) i += 1;
  return i;
}

function parseFolded(
  lines: YamlLine[],
  start: number,
  keyIndent: number,
  style: ">" | "|",
): { value: string; next: number } {
  const chunks: string[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.empty) {
      chunks.push("");
      i += 1;
      continue;
    }
    if (isComment(line) && line.indent <= keyIndent) break;
    if (line.indent <= keyIndent) break;
    chunks.push(line.text);
    i += 1;
  }
  while (chunks.length && chunks[chunks.length - 1] === "") chunks.pop();
  const joined = style === ">" ? chunks.join(" ").replace(/\s+/g, " ").trim() : chunks.join("\n").trim();
  return { value: joined, next: i };
}

function parseList(lines: YamlLine[], start: number, parentIndent: number): { value: YamlValue[]; next: number } {
  const items: YamlValue[] = [];
  let i = start;
  let siblingIndent: number | null = null;

  while (i < lines.length) {
    i = skipNoise(lines, i);
    if (i >= lines.length) break;
    const line = lines[i];
    if (line.indent <= parentIndent) break;
    if (siblingIndent == null) siblingIndent = line.indent;
    if (line.indent < siblingIndent) break;
    if (line.indent > siblingIndent) {
      i += 1;
      continue;
    }

    if (LIST_BARE_RE.test(line.text)) {
      const nested = parseNode(lines, i + 1, line.indent);
      items.push(nested.value);
      i = nested.next;
      continue;
    }

    const asMap = line.text.match(LIST_MAP_RE);
    if (asMap) {
      const map: YamlMap = {};
      const key = asMap[1];
      const rest = asMap[2];
      if (rest.trim() === "") {
        const nested = parseNode(lines, i + 1, line.indent);
        map[key] = nested.value;
        i = nested.next;
      } else {
        map[key] = parseScalar(rest);
        i += 1;
      }
      const extra = parseMap(lines, i, line.indent);
      Object.assign(map, extra.value);
      items.push(map);
      i = extra.next;
      continue;
    }

    const asScalar = line.text.match(LIST_SCALAR_RE);
    if (asScalar) {
      items.push(parseScalar(asScalar[1]));
      i += 1;
      continue;
    }

    break;
  }

  return { value: items, next: i };
}

function parseMap(lines: YamlLine[], start: number, parentIndent: number): { value: YamlMap; next: number } {
  const obj: YamlMap = {};
  let i = start;
  let siblingIndent: number | null = null;

  while (i < lines.length) {
    i = skipNoise(lines, i);
    if (i >= lines.length) break;
    const line = lines[i];
    if (line.indent <= parentIndent) break;
    if (siblingIndent == null) siblingIndent = line.indent;
    if (line.indent < siblingIndent) break;
    if (line.indent > siblingIndent) {
      i += 1;
      continue;
    }

    const folded = line.text.match(FOLDED_RE);
    if (folded) {
      const block = parseFolded(lines, i + 1, line.indent, folded[2] as ">" | "|");
      obj[folded[1]] = block.value;
      i = block.next;
      continue;
    }

    const kv = line.text.match(KEY_RE);
    if (!kv) {
      i += 1;
      continue;
    }

    const key = kv[1];
    const rest = kv[2];
    if (rest.trim() === "") {
      const nested = parseNode(lines, i + 1, line.indent);
      obj[key] = nested.value;
      i = nested.next;
    } else {
      obj[key] = parseScalar(rest);
      i += 1;
    }
  }

  return { value: obj, next: i };
}

function parseNode(lines: YamlLine[], start: number, parentIndent: number): { value: YamlValue; next: number } {
  const i = skipNoise(lines, start);
  if (i >= lines.length) return { value: "", next: i };
  const line = lines[i];
  if (line.indent <= parentIndent) return { value: "", next: i };
  if (line.text.startsWith("- ") || LIST_BARE_RE.test(line.text)) {
    return parseList(lines, i, parentIndent);
  }
  return parseMap(lines, i, parentIndent);
}

export function parseYamlBlock(block: string): YamlParseResult {
  const warnings: string[] = [];
  try {
    const lines = tokenize(block);
    const { value } = parseMap(lines, 0, -1);
    return { fields: value, warnings };
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "YAML parse failed.");
    return { fields: {}, warnings };
  }
}

export function splitFrontmatter(markdown: string): SplitFrontmatter {
  const warnings: string[] = [];
  const text = markdown.replace(/^\uFEFF/, "");
  if (!text.startsWith("---")) {
    return { hasFrontmatter: false, closed: false, frontmatterRaw: "", body: text, warnings };
  }
  const rest = text.slice(3);
  if (!rest.startsWith("\n") && !rest.startsWith("\r\n")) {
    warnings.push("Opening --- is not on its own line — treating the paste as body.");
    return { hasFrontmatter: false, closed: false, frontmatterRaw: "", body: text, warnings };
  }
  const close = rest.search(/\n---[ \t]*(?:\n|$)/);
  if (close === -1) {
    warnings.push("Unclosed YAML frontmatter — treating the whole paste as body.");
    return { hasFrontmatter: false, closed: false, frontmatterRaw: "", body: text, warnings };
  }
  const frontmatterRaw = rest.slice(rest.startsWith("\r\n") ? 2 : 1, close);
  const after = rest.slice(close).replace(/^\n---[ \t]*/, "").replace(/^\n/, "");
  return { hasFrontmatter: true, closed: true, frontmatterRaw, body: after, warnings };
}

export function asString(value: YamlValue | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

export function asStringList(value: YamlValue | undefined): string[] {
  const out: string[] = [];
  collectStrings(value, out);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const item of out) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique;
}

function collectStrings(value: YamlValue | undefined, into: string[]): void {
  if (value == null) return;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = String(value).trim();
    if (text) into.push(text);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, into);
    return;
  }
  if ("name" in value && value.name != null) {
    const name = asString(value.name);
    if (name) into.push(name);
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (key === "tags" || key === "bins" || key === "tools" || key === "triggers" || key === "env") {
      collectStrings(nested, into);
    }
  }
}

export function pickField(fields: YamlMap, ...keys: string[]): YamlValue | undefined {
  for (const key of keys) {
    if (key in fields && fields[key] != null && fields[key] !== "") return fields[key];
  }
  return undefined;
}

export function nestedMap(value: YamlValue | undefined): YamlMap | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}
