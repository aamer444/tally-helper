import { createHash } from "node:crypto";

/** A run of text placed at (x, y) points on an A4 page, y from the bottom. */
export interface PdfText {
  text: string;
  x: number;
  y: number;
  size?: number;
}

const PAD = Buffer.from("28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A", "hex");
const md5 = (...parts: Buffer[]) => createHash("md5").update(Buffer.concat(parts)).digest();
const padded = (password: string) => Buffer.concat([Buffer.from(password, "latin1"), PAD]).subarray(0, 32);

function rc4(key: Buffer, data: Buffer): Buffer {
  const s = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
  }
  const out = Buffer.alloc(data.length);
  for (let n = 0, i = 0, j = 0; n < data.length; n++) {
    i = (i + 1) & 255;
    j = (j + s[i]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
    out[n] = data[n] ^ s[(s[i] + s[j]) & 255];
  }
  return out;
}

const rc4Rounds = (key: Buffer, data: Buffer) =>
  Array.from({ length: 19 }, (_, i) => i + 1).reduce((d, i) => rc4(Buffer.from(key.map((b) => b ^ i)), d), rc4(key, data));

/** PDF Standard Security Handler, revision 3 (128-bit RC4): what bank and supplier PDFs commonly use. */
function encryption(userPassword: string, id: Buffer) {
  const permissions = Buffer.alloc(4);
  permissions.writeInt32LE(-4);
  let ownerKey = md5(padded(userPassword));
  for (let i = 0; i < 50; i++) ownerKey = md5(ownerKey);
  const owner = rc4Rounds(ownerKey, padded(userPassword));

  let key = md5(padded(userPassword), owner, permissions, id);
  for (let i = 0; i < 50; i++) key = md5(key);
  const user = Buffer.concat([rc4Rounds(key, md5(PAD, id)), Buffer.alloc(16)]);

  const objectKey = (num: number) => md5(key, Buffer.from([num & 255, (num >> 8) & 255, (num >> 16) & 255, 0, 0]));
  return {
    dict: `<< /Filter /Standard /V 2 /R 3 /Length 128 /P -4 /O <${owner.toString("hex")}> /U <${user.toString("hex")}> >>`,
    encrypt: (num: number, data: Buffer) => rc4(objectKey(num), data),
  };
}

const escapeText = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);

/** Builds a small text-only PDF for tests; with `userPassword` it can only be opened with that password. */
export function makePdf(pages: PdfText[][], options: { userPassword?: string } = {}): Uint8Array<ArrayBuffer> {
  const id = md5(Buffer.from(JSON.stringify(pages)));
  const crypt = options.userPassword === undefined ? null : encryption(options.userPassword, id);
  const fontNum = 3 + pages.length * 2;
  const objects: (string | Buffer)[] = [];
  const set = (num: number, body: string | Buffer) => (objects[num - 1] = body);

  set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  set(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(" ")}] >>`);
  pages.forEach((texts, i) => {
    const pageNum = 3 + i * 2;
    const contentNum = pageNum + 1;
    const content = Buffer.from(
      texts.map((t) => `BT /F1 ${t.size ?? 9} Tf ${t.x} ${t.y} Td (${escapeText(t.text)}) Tj ET`).join("\n"),
      "latin1",
    );
    const data = crypt ? crypt.encrypt(contentNum, content) : content;
    set(pageNum, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontNum} 0 R >> >> /Contents ${contentNum} 0 R >>`);
    set(contentNum, Buffer.concat([Buffer.from(`<< /Length ${data.length} >>\nstream\n`), data, Buffer.from("\nendstream")]));
  });
  set(fontNum, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  if (crypt) set(fontNum + 1, crypt.dict);

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n")];
  const offsets: number[] = [];
  let length = chunks[0].length;
  objects.forEach((body, i) => {
    offsets.push(length);
    const chunk = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), Buffer.from(body), Buffer.from("\nendobj\n")]);
    chunks.push(chunk);
    length += chunk.length;
  });
  const xref = [`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`, ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)].join("");
  const hexId = id.toString("hex");
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R${crypt ? ` /Encrypt ${fontNum + 1} 0 R` : ""} /ID [<${hexId}> <${hexId}>] >>\nstartxref\n${length}\n%%EOF\n`;
  chunks.push(Buffer.from(xref + trailer));
  return new Uint8Array(Buffer.concat(chunks));
}
