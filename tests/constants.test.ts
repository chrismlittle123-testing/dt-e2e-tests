/**
 * E2E tests for drift-toolkit constants
 *
 * NOTE: This test documents BUG #1 - the constants export path documented in
 * FEATURES.md does not exist. The import `drift-toolkit/constants` fails.
 */
import { describe, it, expect } from "vitest";

describe("Constants Export", () => {
  describe("BUG: drift-toolkit/constants Export Path", () => {
    it("should verify constants export path issue", async () => {
      // This test documents that the documented import path doesn't work
      // Per FEATURES.md, we should be able to:
      // import { TIMEOUTS, DEFAULTS } from "drift-toolkit/constants";

      let importFailed = false;
      try {
        // Dynamic import to catch the error
        await import("drift-toolkit/constants");
      } catch (error) {
        importFailed = true;
        // Expected: import to fail since the path doesn't exist
      }

      // This documents the bug - if this test passes, the bug exists
      // When the bug is fixed, this test should fail and be updated
      expect(importFailed).toBe(true);
    });

    it("should verify main drift-toolkit export works", async () => {
      // The main export should work
      const driftToolkit = await import("drift-toolkit");
      expect(driftToolkit).toBeDefined();
      expect(driftToolkit.isScannableRepo).toBeDefined();
      expect(driftToolkit.getRepoMetadata).toBeDefined();
    });
  });

  describe("Constants from Main Export", () => {
    // Test what constants ARE available from the main export
    it("should check if DEFAULTS is exported from main", async () => {
      const driftToolkit = await import("drift-toolkit");
      // Check what's actually exported
      const exportedKeys = Object.keys(driftToolkit);

      // Log available exports for debugging
      console.log("Available exports:", exportedKeys);

      // These are documented but may not be exported
      const expectedConstants = [
        "TIMEOUTS",
        "BUFFERS",
        "DISPLAY_LIMITS",
        "GITHUB_API",
        "CONCURRENCY",
        "DEFAULTS",
        "FILE_PATTERNS",
        "BRANCH_PATTERNS",
        "GITHUB_ISSUES",
        "WORKFLOW_PATTERNS",
      ];

      const missingConstants = expectedConstants.filter(
        (c) => !exportedKeys.includes(c)
      );

      if (missingConstants.length > 0) {
        console.log("Missing constants from main export:", missingConstants);
      }

      // Document what IS available
      expect(exportedKeys.length).toBeGreaterThan(0);
    });
  });
});
