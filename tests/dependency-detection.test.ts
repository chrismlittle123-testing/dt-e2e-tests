/**
 * E2E tests for dependency change detection features
 *
 * NOTE: BUG #16 - detectDependencyChanges and getTrackedDependencyFiles
 * are documented in FEATURES.md but are not exported from drift-toolkit.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMockRepo, exec, createTempDir, writeFile } from "../src/utils.js";
import { join } from "path";
import { rmSync } from "fs";
import {
  getHeadCommit,
  getDependencies,
  detectCheckTomlChanges,
} from "drift-toolkit";

describe("Dependency Change Detection", () => {
  let testRepo: { path: string; cleanup: () => void };

  afterEach(() => {
    if (testRepo) testRepo.cleanup();
  });

  // BUG #16: These functions are documented but not exported
  describe("BUG: Missing Exports", () => {
    it("should export detectDependencyChanges (BUG: not exported)", async () => {
      const driftToolkit = await import("drift-toolkit");

      // Document the bug: this function should be exported per FEATURES.md
      expect(driftToolkit.detectDependencyChanges).toBeUndefined();
    });

    it("should export getTrackedDependencyFiles (BUG: not exported)", async () => {
      const driftToolkit = await import("drift-toolkit");

      // Document the bug: this function should be exported per FEATURES.md
      expect(driftToolkit.getTrackedDependencyFiles).toBeUndefined();
    });
  });

  describe("getDependencies (Available Export)", () => {
    it("should get dependencies for a repo", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
        ".eslintrc.js": "module.exports = {}",
        "tsconfig.json": "{}",
      });

      // getDependencies is available
      const deps = getDependencies(testRepo.path);
      expect(deps).toBeDefined();
    });
  });

  describe("detectCheckTomlChanges (Available Export)", () => {
    it("should detect check.toml changes", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
      });

      const baseCommit = getHeadCommit(testRepo.path);

      // Modify check.toml
      writeFile(join(testRepo.path, "check.toml"), "[checks]\nname = 'modified'\n");
      exec("git add -A && git commit -m 'Modify check.toml'", { cwd: testRepo.path });

      const changes = detectCheckTomlChanges(testRepo.path, {
        baseCommit,
        targetCommit: "HEAD",
      });

      expect(changes.hasChanges).toBe(true);
      expect(changes.modified.length).toBeGreaterThan(0);
    });

    it("should return hasChanges:false when no changes", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
      });

      const commit = getHeadCommit(testRepo.path);

      const changes = detectCheckTomlChanges(testRepo.path, {
        baseCommit: commit,
        targetCommit: commit,
      });

      expect(changes.hasChanges).toBe(false);
    });
  });

  describe("getHeadCommit", () => {
    it("should return HEAD commit SHA", () => {
      testRepo = createMockRepo({
        "README.md": "# Test",
      });

      const sha = getHeadCommit(testRepo.path);

      expect(sha).toBeDefined();
      expect(sha.length).toBe(40); // Full SHA
    });
  });
});
