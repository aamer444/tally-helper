const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };

// Characters XML 1.0 does not allow at all; PDFs with broken font maps can produce them.
// eslint-disable-next-line no-control-regex
const ILLEGAL_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

/** Every value from a user's file goes through this before it is put into a Tally request. */
export function escapeXml(text: string): string {
  return text.replace(ILLEGAL_XML_CHARS, "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

// Tally sometimes emits control-character references (e.g. &#4;) that strict XML parsers reject.
const CONTROL_CHAR_REFS = /&#(?:x0*[0-8bcef]|x0*1[0-9a-f]|0*(?:[0-8]|1[1-2]|1[4-9]|2[0-9]|3[01]));/gi;

export function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text.replace(CONTROL_CHAR_REFS, ""), "text/xml");
  if (doc.getElementsByTagName("parsererror").length) {
    throw new Error("Tally sent a reply that could not be read.");
  }
  return doc;
}

/** Text of a direct child element, so nested lists with the same tag name are not picked up. */
export function childText(el: Element, tag: string): string {
  for (const child of el.children) {
    if (child.tagName === tag) return child.textContent?.trim() ?? "";
  }
  return "";
}
