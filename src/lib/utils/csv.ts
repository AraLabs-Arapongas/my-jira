export type CsvTask = {
  title: string;
  description?: string | null;
  priority?: "low" | "medium" | "high";
  label?: string | null;
  epic?: string | null;
};

// RFC 4180-ish: handles quoted fields with embedded commas, quotes ("") and CRLF.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

const VALID_PRIORITIES = new Set(["low", "medium", "high"]);

export function parseCsvTasks(text: string): CsvTask[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = {
    title: header.indexOf("title"),
    description: header.indexOf("description"),
    priority: header.indexOf("priority"),
    label: header.indexOf("label"),
    epic: header.indexOf("epic"),
  };
  if (idx.title === -1) {
    throw new Error('CSV must have a "title" column');
  }

  const out: CsvTask[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const title = (r[idx.title] ?? "").trim();
    if (!title) continue;

    const rawPriority = idx.priority >= 0 ? (r[idx.priority] ?? "").trim().toLowerCase() : "";
    const priority = VALID_PRIORITIES.has(rawPriority)
      ? (rawPriority as CsvTask["priority"])
      : undefined;

    out.push({
      title,
      description: idx.description >= 0 ? (r[idx.description] ?? "").trim() || null : null,
      priority,
      label: idx.label >= 0 ? (r[idx.label] ?? "").trim() || null : null,
      epic: idx.epic >= 0 ? (r[idx.epic] ?? "").trim() || null : null,
    });
  }
  return out;
}
