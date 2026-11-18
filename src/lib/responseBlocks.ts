export type ResponseBlock = { kind: 'text'; text: string } | { kind: 'code'; language: string; text: string } | { kind: 'table'; headers: string[]; rows: string[][] };
const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, '|'));
export function responseBlocks(text: string): ResponseBlock[] {
  const lines = text.split('\n');
  const blocks: ResponseBlock[] = [];
  for (let index = 0; index < lines.length; index++) {
    const fence = lines[index].match(/^\s*```([\w+-]*)\s*$/);
    if (fence) {
      const code = [];
      while (++index < lines.length && !/^\s*```\s*$/.test(lines[index])) code.push(lines[index]);
      blocks.push({ kind: 'code', language: fence[1] || 'text', text: code.join('\n') }); continue;
    }
    if (lines[index].includes('|') && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1]) && cells(lines[index + 1]).every(cell => /^:?-{3,}:?$/.test(cell))) {
      const headers = cells(lines[index]); index++;
      const rows = [];
      while (index + 1 < lines.length && lines[index + 1].includes('|') && lines[index + 1].trim()) rows.push(cells(lines[++index]));
      blocks.push({ kind: 'table', headers, rows }); continue;
    }
    blocks.push({ kind: 'text', text: lines[index] });
  }
  return blocks;
}
