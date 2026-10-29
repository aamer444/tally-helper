import { describe, expect, test } from "vitest";
import { parseDateCell } from "./dates";
import { paiseToTally, parseAmount } from "./money";
import { escapeXml } from "./xml";

describe("parseAmount", () => {
  test.each([
    ["12,980.00", 1_298_000],
    ["₹ 500", 50_000],
    ["Rs. 1,00,000.50", 10_000_050],
    ["(250)", -25_000],
    ["-0.29", -29],
    [118.5, 11_850],
  ])("reads %s as %i paise", (input, paise) => {
    expect(parseAmount(input)).toBe(paise);
  });

  test.each(["", "-", "abc", "12.3.4", null, undefined])("returns null for %s", (input) => {
    expect(parseAmount(input)).toBeNull();
  });
});

describe("paiseToTally", () => {
  test("writes two decimals without grouping, keeping the sign", () => {
    expect(paiseToTally(1_180_000)).toBe("11800.00");
    expect(paiseToTally(-1_180_005)).toBe("-11800.05");
    expect(paiseToTally(7)).toBe("0.07");
  });
});

describe("parseDateCell", () => {
  test.each([
    ["05/04/2025", "20250405"],
    ["5-4-25", "20250405"],
    ["05.04.2025", "20250405"],
    ["2025-04-05", "20250405"],
    ["2025-04-05T00:00:00", "20250405"],
    ["5-Apr-2025", "20250405"],
    ["05 April 2025", "20250405"],
    ["20250405", "20250405"],
    [45752, "20250405"], // Excel serial number
  ])("reads %s day-first", (input, expected) => {
    expect(parseDateCell(input)).toBe(expected);
  });

  test.each(["31/02/2025", "hello", "", "13-13-2025"])("rejects %s", (input) => {
    expect(parseDateCell(input)).toBeNull();
  });
});

describe("escapeXml", () => {
  test("escapes characters that would break or inject into a Tally request", () => {
    expect(escapeXml(`Patel & Sons <"Main">'s`)).toBe("Patel &amp; Sons &lt;&quot;Main&quot;&gt;&apos;s");
  });

  test("drops control characters XML does not allow, keeping tabs and line breaks", () => {
    expect(escapeXml("INV\u0000-1\u001F2\tA\nB")).toBe("INV-12\tA\nB");
  });
});
