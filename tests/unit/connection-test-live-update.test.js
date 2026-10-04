/**
 * Regression test: connection test results must update the list immediately.
 *
 * Previously, running "Test Connection" (a.k.a. "Test akun") only updated a
 * local badge inside the modal — the parent list kept the stale testStatus
 * until the whole page was reloaded. The same was true for the batch
 * ("Test All") buttons on the provider list page.
 *
 * These are source-text assertions (the files are Next.js client components
 * that cannot be imported directly in unit tests).
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const modalSrc = fs.readFileSync(
  path.resolve("../src/shared/components/EditConnectionModal.js"),
  "utf-8"
);

const detailPageSrc = fs.readFileSync(
  path.resolve("../src/app/(dashboard)/dashboard/providers/[id]/page.js"),
  "utf-8"
);

const listPageSrc = fs.readFileSync(
  path.resolve("../src/app/(dashboard)/dashboard/providers/page.js"),
  "utf-8"
);

describe("EditConnectionModal reports test results upward", () => {
  it("accepts an onTested callback prop", () => {
    expect(modalSrc).toMatch(/EditConnectionModal\(\{[^}]*onTested[^}]*\}\)/s);
  });

  it("invokes onTested with the connection id and outcome", () => {
    expect(modalSrc).toMatch(/onTested\(connection\.id,\s*outcome\)/);
  });

  it("captures validity and error from the test response", () => {
    expect(modalSrc).toMatch(/valid:\s*!!data\.valid/);
    expect(modalSrc).toMatch(/error:\s*data\.error \|\| null/);
  });
});

describe("provider detail page syncs the badge after a test", () => {
  it("defines handleConnectionTested that patches connections state", () => {
    expect(detailPageSrc).toMatch(/const handleConnectionTested = \(id, result\) => \{/);
    expect(detailPageSrc).toMatch(/testStatus:\s*result\?\.valid \? "active" : "error"/);
  });

  it("passes onTested to EditConnectionModal", () => {
    expect(detailPageSrc).toMatch(/onTested=\{handleConnectionTested\}/);
  });

  it("one-by-one run also updates the persistent status badge", () => {
    expect(detailPageSrc).toMatch(
      /Keep the persistent status badge in sync immediately/
    );
    expect(detailPageSrc).toMatch(/testStatus:\s*valid \? "active" : "error"/);
  });
});

describe("provider list page syncs badges after a batch test", () => {
  it("maps batch results by connectionId and patches connections", () => {
    expect(listPageSrc).toMatch(/new Map\(data\.results\.map\(\(r\) => \[r\.connectionId, r\]\)\)/);
    expect(listPageSrc).toMatch(/testStatus:\s*r\.valid \? "active" : "error"/);
  });
});
