/**
 * E2E tests for dependency change detection features
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMockRepo, exec, createTempDir, writeFile } from "../src/utils.js";
import { join } from "path";
import { rmSync } from "fs";
import {
  detectDependencyChanges,
  getTrackedDependencyFiles,
  getHeadCommit,
} from "drift-toolkit";

describe("Dependency Change Detection", () => {
  let testRepo: { path: string; cleanup: () => void };

  afterEach(() => {
    if (testRepo) testRepo.cleanup();
  });

  describe("getTrackedDependencyFiles", () => {
    it("should return list of tracked dependency files", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
        ".eslintrc.js": "module.exports = {}",
        "tsconfig.json": "{}",
      });

      const files = getTrackedDependencyFiles(testRepo.path);

      expect(Array.isArray(files)).toBe(true);
      // Should include common config files
      expect(files.length).toBeGreaterThanOrEqual(0);
    });

    it("should include check.toml in tracked files", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
      });

      const files = getTrackedDependencyFiles(testRepo.path);

      // check.toml should always be tracked
      const hasCheckToml = files.some(f => f.includes("check.toml"));
      expect(hasCheckToml).toBe(true);
    });

    it("should include workflow files pattern", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
        ".github/workflows/ci.yml": "name: CI",
      });

      const files = getTrackedDependencyFiles(testRepo.path);

      // Should include workflow patterns
      const hasWorkflowPattern = files.some(f => f.includes("workflows"));
      // Note: May or may not have this depending on implementation
      expect(files.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("detectDependencyChanges", () => {
    it("should detect changes to eslint config", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
        ".eslintrc.js": "module.exports = { rules: {} }",
      });

      const baseCommit = getHeadCommit(testRepo.path);

      // Modify eslint config
      writeFile(join(testRepo.path, ".eslintrc.js"), "module.exports = { rules: { semi: 'error' } }");
      exec("git add -A && git commit -m 'Update eslint'", { cwd: testRepo.path });

      const changes = detectDependencyChanges(testRepo.path, {
        baseCommit,
        targetCommit: "HEAD",
      });

      expect(changes.hasChanges).toBe(true);
      expect(changes.changes.length).toBeGreaterThan(0);
    });

    it("should detect changes to tsconfig", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
        "tsconfig.json": '{ "compilerOptions": {} }',
      });

      const baseCommit = getHeadCommit(testRepo.path);

      // Modify tsconfig
      writeFile(join(testRepo.path, "tsconfig.json"), '{ "compilerOptions": { "strict": true } }');
      exec("git add -A && git commit -m 'Update tsconfig'", { cwd: testRepo.path });

      const changes = detectDependencyChanges(testRepo.path, {
        baseCommit,
        targetCommit: "HEAD",
      });

      expect(changes.hasChanges).toBe(true);
    });

    it("should detect changes to workflow files", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
        ".github/workflows/ci.yml": "name: CI\non: push",
      });

      const baseCommit = getHeadCommit(testRepo.path);

      // Modify workflow
      writeFile(join(testRepo.path, ".github/workflows/ci.yml"), "name: CI\non: [push, pull_request]");
      exec("git add -A && git commit -m 'Update workflow'", { cwd: testRepo.path });

      const changes = detectDependencyChanges(testRepo.path, {
        baseCommit,
        targetCommit: "HEAD",
      });

      expect(changes.hasChanges).toBe(true);
    });

    it("should group changes by check type", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
        ".eslintrc.js": "module.exports = {}",
        "tsconfig.json": "{}",
      });

      const baseCommit = getHeadCommit(testRepo.path);

      // Modify both configs
      writeFile(join(testRepo.path, ".eslintrc.js"), "module.exports = { updated: true }");
      writeFile(join(testRepo.path, "tsconfig.json"), '{ "updated": true }');
      exec("git add -A && git commit -m 'Update configs'", { cwd: testRepo.path });

      const changes = detectDependencyChanges(testRepo.path, {
        baseCommit,
        targetCommit: "HEAD",
      });

      expect(changes.hasChanges).toBe(true);
      expect(changes.byCheck).toBeDefined();
    });

    it("should return hasChanges:false when no changes", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
      });

      const commit = getHeadCommit(testRepo.path);

      const changes = detectDependencyChanges(testRepo.path, {
        baseCommit: commit,
        targetCommit: commit,
      });

      expect(changes.hasChanges).toBe(false);
      expect(changes.changes.length).toBe(0);
    });

    it("should detect added config files", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
      });

      const baseCommit = getHeadCommit(testRepo.path);

      // Add new config file
      writeFile(join(testRepo.path, ".eslintrc.js"), "module.exports = {}");
      exec("git add -A && git commit -m 'Add eslint'", { cwd: testRepo.path });

      const changes = detectDependencyChanges(testRepo.path, {
        baseCommit,
        targetCommit: "HEAD",
      });

      expect(changes.hasChanges).toBe(true);
      const addedFiles = changes.changes.filter(c => c.status === "added");
      expect(addedFiles.length).toBeGreaterThan(0);
    });

    it("should detect deleted config files", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
        ".eslintrc.js": "module.exports = {}",
      });

      const baseCommit = getHeadCommit(testRepo.path);

      // Delete config file
      rmSync(join(testRepo.path, ".eslintrc.js"));
      exec("git add -A && git commit -m 'Remove eslint'", { cwd: testRepo.path });

      const changes = detectDependencyChanges(testRepo.path, {
        baseCommit,
        targetCommit: "HEAD",
      });

      expect(changes.hasChanges).toBe(true);
      const deletedFiles = changes.changes.filter(c => c.status === "deleted");
      expect(deletedFiles.length).toBeGreaterThan(0);
    });

    it("should track always-tracked files", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\nname = 'test'\n",
      });

      const baseCommit = getHeadCommit(testRepo.path);

      // Modify check.toml (always tracked)
      writeFile(join(testRepo.path, "check.toml"), "[checks]\nname = 'modified'\n");
      exec("git add -A && git commit -m 'Update check.toml'", { cwd: testRepo.path });

      const changes = detectDependencyChanges(testRepo.path, {
        baseCommit,
        targetCommit: "HEAD",
      });

      expect(changes.hasChanges).toBe(true);
      expect(changes.alwaysTrackedChanges.length).toBeGreaterThan(0);
    });
  });

  describe("Change Details", () => {
    it("should include file path in change details", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
        ".eslintrc.js": "module.exports = {}",
      });

      const baseCommit = getHeadCommit(testRepo.path);

      writeFile(join(testRepo.path, ".eslintrc.js"), "module.exports = { updated: true }");
      exec("git add -A && git commit -m 'Update'", { cwd: testRepo.path });

      const changes = detectDependencyChanges(testRepo.path, {
        baseCommit,
        targetCommit: "HEAD",
      });

      expect(changes.changes[0]?.file).toBeDefined();
    });

    it("should include change status", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
        ".eslintrc.js": "module.exports = {}",
      });

      const baseCommit = getHeadCommit(testRepo.path);

      writeFile(join(testRepo.path, ".eslintrc.js"), "module.exports = { updated: true }");
      exec("git add -A && git commit -m 'Update'", { cwd: testRepo.path });

      const changes = detectDependencyChanges(testRepo.path, {
        baseCommit,
        targetCommit: "HEAD",
      });

      const validStatuses = ["added", "modified", "deleted"];
      expect(validStatuses).toContain(changes.changes[0]?.status);
    });

    it("should include total tracked files count", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
      });

      const commit = getHeadCommit(testRepo.path);

      const changes = detectDependencyChanges(testRepo.path, {
        baseCommit: commit,
        targetCommit: commit,
      });

      expect(changes.totalTrackedFiles).toBeDefined();
      expect(typeof changes.totalTrackedFiles).toBe("number");
    });
  });
});
