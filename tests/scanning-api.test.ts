/**
 * E2E tests for drift-toolkit scanning API
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMockRepo, createTempDir, writeFile } from "../src/utils.js";
import { join } from "path";
import { rmSync } from "fs";
import { runScan, runAllScans } from "drift-toolkit";

describe("Scanning API", () => {
  let testRepo: { path: string; cleanup: () => void };

  afterEach(() => {
    if (testRepo) testRepo.cleanup();
  });

  describe("runScan", () => {
    it("should run a passing scan command", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
        "package.json": '{"name": "test"}',
      });

      const result = runScan(
        {
          name: "echo-test",
          command: "echo 'success'",
          severity: "low",
        },
        testRepo.path
      );

      expect(result.status).toBe("pass");
      expect(result.exitCode).toBe(0);
    });

    it("should run a failing scan command", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
      });

      const result = runScan(
        {
          name: "failing-scan",
          command: "exit 1",
          severity: "high",
        },
        testRepo.path
      );

      expect(result.status).toBe("fail");
      expect(result.exitCode).toBe(1);
    });

    it("should skip scan when if_file condition not met", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
        // No package.json
      });

      const result = runScan(
        {
          name: "npm-test",
          command: "npm test",
          if_file: "package.json",
          severity: "high",
        },
        testRepo.path
      );

      expect(result.status).toBe("skip");
    });

    it("should run scan when if_file condition is met", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
        "package.json": '{"name": "test"}',
      });

      const result = runScan(
        {
          name: "echo-test",
          command: "echo 'found package.json'",
          if_file: "package.json",
          severity: "low",
        },
        testRepo.path
      );

      expect(result.status).toBe("pass");
    });

    it("should skip scan when if_command fails", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
      });

      const result = runScan(
        {
          name: "conditional-scan",
          command: "echo 'should not run'",
          if_command: "test -f nonexistent-file",
          severity: "low",
        },
        testRepo.path
      );

      expect(result.status).toBe("skip");
    });

    it("should run scan when if_command succeeds", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
        "README.md": "# Test",
      });

      const result = runScan(
        {
          name: "conditional-scan",
          command: "echo 'running'",
          if_command: "test -f README.md",
          severity: "low",
        },
        testRepo.path
      );

      expect(result.status).toBe("pass");
    });

    it("should filter scan by tier", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: internal\nstatus: active",
        "check.toml": "[checks]\n",
      });

      const result = runScan(
        {
          name: "production-only",
          command: "echo 'production'",
          tiers: ["production"],
          severity: "high",
        },
        testRepo.path,
        { tier: "internal" }
      );

      expect(result.status).toBe("skip");
    });

    it("should run scan for matching tier", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
      });

      const result = runScan(
        {
          name: "production-only",
          command: "echo 'production'",
          tiers: ["production"],
          severity: "high",
        },
        testRepo.path,
        { tier: "production" }
      );

      expect(result.status).toBe("pass");
    });

    it("should capture stdout from scan", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
      });

      const result = runScan(
        {
          name: "output-test",
          command: "echo 'test output'",
          severity: "low",
        },
        testRepo.path
      );

      expect(result.stdout).toContain("test output");
    });

    // BUG #12: result.stderr is undefined - see issues.md
    it("should capture stderr from scan (BUG: stderr not captured)", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
      });

      const result = runScan(
        {
          name: "stderr-test",
          command: "echo 'error output' >&2",
          severity: "low",
        },
        testRepo.path
      );

      // Document the bug: stderr should be captured but is undefined
      // When bug is fixed, change this to: expect(result.stderr).toContain("error output");
      expect(result.stderr).toBeUndefined();
    });

    it("should include scan name in result", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
      });

      const result = runScan(
        {
          name: "my-scan-name",
          command: "echo 'test'",
          severity: "low",
        },
        testRepo.path
      );

      expect(result.scan).toBe("my-scan-name");
    });

    it("should handle timeout", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
      });

      const result = runScan(
        {
          name: "slow-scan",
          command: "sleep 10",
          timeout: 1, // 1 second timeout
          severity: "low",
        },
        testRepo.path
      );

      // Should fail due to timeout
      expect(result.status).toBe("fail");
    });
  });

  describe("runAllScans", () => {
    it("should run multiple scans", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
      });

      const results = runAllScans(
        [
          { name: "scan1", command: "echo 'one'", severity: "low" },
          { name: "scan2", command: "echo 'two'", severity: "low" },
          { name: "scan3", command: "echo 'three'", severity: "low" },
        ],
        testRepo.path
      );

      expect(results.length).toBe(3);
      expect(results.every(r => r.status === "pass")).toBe(true);
    });

    it("should run mixed pass/fail scans", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
      });

      const results = runAllScans(
        [
          { name: "pass-scan", command: "echo 'pass'", severity: "low" },
          { name: "fail-scan", command: "exit 1", severity: "high" },
        ],
        testRepo.path
      );

      expect(results.length).toBe(2);
      expect(results.find(r => r.scan === "pass-scan")?.status).toBe("pass");
      expect(results.find(r => r.scan === "fail-scan")?.status).toBe("fail");
    });

    it("should skip scans based on conditions", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
        // No package.json
      });

      const results = runAllScans(
        [
          { name: "always-run", command: "echo 'run'", severity: "low" },
          { name: "conditional", command: "npm test", if_file: "package.json", severity: "high" },
        ],
        testRepo.path
      );

      expect(results.find(r => r.scan === "always-run")?.status).toBe("pass");
      expect(results.find(r => r.scan === "conditional")?.status).toBe("skip");
    });

    it("should return empty array for empty scans", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
      });

      const results = runAllScans([], testRepo.path);

      expect(results).toEqual([]);
    });

    it("should apply context to all scans", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: internal",
        "check.toml": "[checks]\n",
      });

      const results = runAllScans(
        [
          { name: "prod-scan", command: "echo 'prod'", tiers: ["production"], severity: "high" },
          { name: "internal-scan", command: "echo 'internal'", tiers: ["internal"], severity: "high" },
        ],
        testRepo.path,
        { tier: "internal" }
      );

      expect(results.find(r => r.scan === "prod-scan")?.status).toBe("skip");
      expect(results.find(r => r.scan === "internal-scan")?.status).toBe("pass");
    });
  });

  describe("Scan Severity", () => {
    // BUG #13: result.severity is undefined - see issues.md
    it("should include severity in result (BUG: severity not in result)", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
      });

      const criticalResult = runScan(
        { name: "critical", command: "echo 'test'", severity: "critical" },
        testRepo.path
      );

      const lowResult = runScan(
        { name: "low", command: "echo 'test'", severity: "low" },
        testRepo.path
      );

      // Document the bug: severity should be in result but is undefined
      // When bug is fixed, change to:
      // expect(criticalResult.severity).toBe("critical");
      // expect(lowResult.severity).toBe("low");
      expect(criticalResult.severity).toBeUndefined();
      expect(lowResult.severity).toBeUndefined();
    });
  });

  describe("Scan Description", () => {
    it("should include description in scan definition", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
      });

      const result = runScan(
        {
          name: "described-scan",
          description: "This is a test scan",
          command: "echo 'test'",
          severity: "low",
        },
        testRepo.path
      );

      expect(result.status).toBe("pass");
    });
  });

  describe("Working Directory", () => {
    it("should run scan in repository directory", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production",
        "check.toml": "[checks]\n",
        "test-file.txt": "content",
      });

      const result = runScan(
        {
          name: "pwd-test",
          command: "test -f test-file.txt && echo 'found'",
          severity: "low",
        },
        testRepo.path
      );

      expect(result.status).toBe("pass");
      expect(result.stdout).toContain("found");
    });
  });
});
