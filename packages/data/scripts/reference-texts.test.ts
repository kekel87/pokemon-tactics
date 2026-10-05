import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const ESCAPED_LINE_BREAK = "\\n";

interface DescribedEntry {
  id: string;
  shortDescription: Record<string, string | null>;
  longDescription: Record<string, string | null>;
}

describe.each(["abilities", "items", "moves"])(
  "committed reference %s.json — description texts",
  (file) => {
    const entries = JSON.parse(
      readFileSync(join(PACKAGE_ROOT, `reference/${file}.json`), "utf-8"),
    ) as DescribedEntry[];

    it("contains no escaped line break in any description, in any language", () => {
      const offenders = entries.flatMap((entry) =>
        (["shortDescription", "longDescription"] as const).flatMap((field) =>
          Object.entries(entry[field])
            .filter(([, text]) => text?.includes(ESCAPED_LINE_BREAK))
            .map(([language]) => `${entry.id}.${field}.${language}`),
        ),
      );
      expect(offenders).toEqual([]);
    });
  },
);
