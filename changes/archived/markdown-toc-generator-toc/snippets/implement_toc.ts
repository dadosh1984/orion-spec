// snippet for Implement toc(md): parse #..######, slugify, indent
export function toc(md: string): string {
  const out: string[] = [];
  for (const line of md.split("\n")) {
    const m = line.match(/^(#{1,6})\s+(.+)$/);
    if (!m) continue;
    const depth = m[1].length;
    const title = m[2].trim();
    const slug = title.toLowerCase().replace(/[^\w\s-]/g,"").replace(/\s+/g,"-");
    out.push(`${"  ".repeat(depth-1)}- [${title}](#${slug})`);
  }
  return out.join("\n");
}
