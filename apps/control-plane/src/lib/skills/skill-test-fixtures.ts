import { once } from "node:events";

import { ZipFile } from "yazl";

export interface SkillZipFixtureFile {
  path: string;
  content: string | Buffer;
  mode?: number;
  compress?: boolean;
}

export async function createZipFixture(files: readonly SkillZipFixtureFile[]): Promise<Buffer> {
  const zip = new ZipFile();
  const chunks: Buffer[] = [];
  zip.outputStream.on("data", (chunk: Buffer) => chunks.push(chunk));

  for (const file of files) {
    const options: { mode?: number; compress?: boolean; mtime: Date } = {
      mtime: new Date("2026-08-24T00:00:00.000Z"),
    };
    if (file.mode !== undefined) options.mode = file.mode;
    if (file.compress !== undefined) options.compress = file.compress;
    zip.addBuffer(Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content), file.path, options);
  }

  zip.end();
  await once(zip.outputStream, "end");
  return Buffer.concat(chunks);
}

export function skillMarkdown(name = "review-evidence", description = "Review evidence exactly."): string {
  return `---\nname: ${name}\ndescription: ${description}\nunknown: ignored\n---\n\n# ${name}\n`;
}

export function replaceZipPath(buffer: Buffer, original: string, replacement: string): Buffer {
  if (Buffer.byteLength(original) !== Buffer.byteLength(replacement)) {
    throw new Error("ZIP fixture path replacements must preserve encoded length");
  }
  const result = Buffer.from(buffer);
  const source = Buffer.from(original);
  const target = Buffer.from(replacement);
  let replacements = 0;
  let offset = 0;
  while ((offset = result.indexOf(source, offset)) !== -1) {
    target.copy(result, offset);
    replacements += 1;
    offset += target.length;
  }
  if (replacements < 2) throw new Error(`Expected local and central ZIP path records for ${original}`);
  return result;
}

export function mutateZipEntryHeaders(
  buffer: Buffer,
  path: string,
  mutate: (header: { kind: "local" | "central"; offset: number }, result: Buffer) => void,
): Buffer {
  const result = Buffer.from(buffer);
  const encodedPath = Buffer.from(path);
  let matches = 0;
  for (let offset = 0; offset <= result.length - 4; offset += 1) {
    const signature = result.readUInt32LE(offset);
    if (signature !== 0x04034b50 && signature !== 0x02014b50) continue;
    const kind = signature === 0x04034b50 ? "local" : "central";
    const nameLength = result.readUInt16LE(offset + (kind === "local" ? 26 : 28));
    const nameOffset = offset + (kind === "local" ? 30 : 46);
    if (nameLength !== encodedPath.length || !result.subarray(nameOffset, nameOffset + nameLength).equals(encodedPath)) continue;
    mutate({ kind, offset }, result);
    matches += 1;
  }
  if (matches !== 2) throw new Error(`Expected local and central headers for ${path}, found ${matches}`);
  return result;
}
