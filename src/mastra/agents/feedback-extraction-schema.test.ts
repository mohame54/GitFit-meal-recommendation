import { standardSchemaToJSONSchema, toStandardSchema } from "@mastra/schema-compat/schema";
import { describe, expect, it } from "vitest";
import { feedbackExtractionSchema } from "./feedback-extraction-schema.js";

function nonStringEnumValues(node: unknown, path: string, hits: string[]): void {
  if (node == null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((item, index) => nonStringEnumValues(item, `${path}[${index}]`, hits));
    return;
  }
  const record = node as Record<string, unknown>;
  if (Array.isArray(record.enum)) {
    record.enum.forEach((value, index) => {
      if (typeof value !== "string") {
        hits.push(`${path}.enum[${index}]=${JSON.stringify(value)}`);
      }
    });
  }
  if ("const" in record && typeof record.const !== "string" && record.const !== undefined) {
    hits.push(`${path}.const=${JSON.stringify(record.const)}`);
  }
  for (const [key, value] of Object.entries(record)) {
    if (key === "enum") continue;
    nonStringEnumValues(value, path ? `${path}.${key}` : key, hits);
  }
}

describe("feedbackExtractionSchema", () => {
  it("sends only string enums to Gemini", () => {
    const json = standardSchemaToJSONSchema(toStandardSchema(feedbackExtractionSchema), {
      io: "input",
    });
    const hits: string[] = [];
    nonStringEnumValues(json, "", hits);
    expect(hits).toEqual([]);
  });

  it("parses numeric and string polarity into -1 | 0 | 1", () => {
    const base = {
      sentiment: "positive" as const,
      attributes: [
        {
          preference_type: "cuisine" as const,
          value: "thai",
          polarity: 1 as const,
        },
      ],
    };
    expect(feedbackExtractionSchema.parse(base).attributes[0]?.polarity).toBe(1);
    expect(
      feedbackExtractionSchema.parse({
        ...base,
        attributes: [{ ...base.attributes[0], polarity: "-1" }],
      }).attributes[0]?.polarity,
    ).toBe(-1);
  });
});
