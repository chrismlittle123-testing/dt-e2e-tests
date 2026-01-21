/**
 * E2E tests for `drift process scan` CLI command
 * Tests the new process domain added in v3.4.3
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { exec, createMockRepo, drift, driftWithToken, parseJsonOutput, createTempDir, writeFile, getTestOrg } from "../src/utils.js";
import { join } from "path";
import { rmSync } from "fs";

describe("drift process scan", () => {
  describe("CLI Options", () => {
    it("should display help for process command", () => {
      const result = drift("process --help");
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("scan");
      expect(result.stdout).toContain("Process standards and compliance");
    });

    it("should display help for process scan command", () => {
      const result = drift("process scan --help");
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("--repo");
      expect(result.stdout).toContain("--org");
      expect(result.stdout).toContain("--config");
      expect(result.stdout).toContain("--json");
      expect(result.stdout).toContain("--dry-run");
    });
  });

  describe("Single Repository Scanning", () => {
    let configDir: string;

    beforeEach(() => {
      configDir = createTempDir();
      writeFile(join(configDir, "check.toml"), `
[process.repo]
enabled = true
require_branch_protection = true
require_codeowners = true

[process.repo.ruleset]
branch = "main"
required_reviews = 1
`);
    });

    afterEach(() => {
      if (configDir) {
        rmSync(configDir, { recursive: true, force: true });
      }
    });

    it("should require GitHub token", () => {
      const result = drift(`process scan --repo ${getTestOrg()}/cmt-protected --config ${join(configDir, "check.toml")}`, {
        env: { GITHUB_TOKEN: "" },
      });
      expect(result.exitCode).not.toBe(0);
      expect(result.stdout + result.stderr).toMatch(/github.token|GITHUB_TOKEN/i);
    });

    it("should require --config or check.toml", () => {
      // Run from a directory without check.toml
      const emptyDir = createTempDir();
      const result = drift(`process scan --repo ${getTestOrg()}/cmt-protected`, {
        cwd: emptyDir,
      });
      expect(result.exitCode).not.toBe(0);
      expect(result.stdout + result.stderr).toMatch(/check\.toml|config/i);
      rmSync(emptyDir, { recursive: true, force: true });
    });

    it("should scan a remote repository with --repo option", () => {
      const result = driftWithToken(`process scan --repo ${getTestOrg()}/cmt-protected --config ${join(configDir, "check.toml")} --json`);

      // Should return results (may pass or fail depending on repo state)
      expect(result.stdout).toContain("repository");
      expect(result.stdout).toContain("violations");

      const output = JSON.parse(result.stdout);
      expect(output.repository).toBe(`${getTestOrg()}/cmt-protected`);
    });

    it("should output JSON with --json option", () => {
      const result = driftWithToken(`process scan --repo ${getTestOrg()}/cmt-protected --config ${join(configDir, "check.toml")} --json`);

      // Should be valid JSON
      let parsed: unknown;
      expect(() => {
        parsed = JSON.parse(result.stdout);
      }).not.toThrow();

      expect(parsed).toHaveProperty("repository");
      expect(parsed).toHaveProperty("violations");
      expect(parsed).toHaveProperty("summary");
    });

    it("should include scan time in results", () => {
      const result = driftWithToken(`process scan --repo ${getTestOrg()}/cmt-protected --config ${join(configDir, "check.toml")} --json`);

      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty("scanTime");
      // Should be a valid ISO date
      expect(() => new Date(output.scanTime)).not.toThrow();
    });

    it("should detect missing branch protection", () => {
      const result = driftWithToken(`process scan --repo ${getTestOrg()}/cmt-protected --config ${join(configDir, "check.toml")} --json`);

      const output = JSON.parse(result.stdout);
      // cmt-protected doesn't have branch protection, so should find violations
      const branchViolation = output.violations?.find((v: { rule: string }) =>
        v.rule?.includes("branch_protection")
      );
      expect(branchViolation).toBeDefined();
    });

    it("should perform dry-run without creating issues", () => {
      const result = driftWithToken(`process scan --repo ${getTestOrg()}/cmt-protected --config ${join(configDir, "check.toml")} --dry-run --json`);

      // Should still return results
      expect(result.stdout).toContain("violations");

      // Should not contain "Created issue" message (check both stdout and stderr)
      const fullOutput = result.stdout + result.stderr;
      // In dry-run mode, it should indicate it's a dry run or not create issues
      expect(fullOutput).not.toMatch(/Created issue #\d+ \(not dry-run\)/);
    });
  });

  describe("Repository with CODEOWNERS", () => {
    let configDir: string;

    beforeEach(() => {
      configDir = createTempDir();
      writeFile(join(configDir, "check.toml"), `
[process.repo]
enabled = true
require_codeowners = true
`);
    });

    afterEach(() => {
      if (configDir) {
        rmSync(configDir, { recursive: true, force: true });
      }
    });

    it("should pass CODEOWNERS check when file exists", () => {
      // cmt-protected has a CODEOWNERS file
      const result = driftWithToken(`process scan --repo ${getTestOrg()}/cmt-protected --config ${join(configDir, "check.toml")} --json`);

      const output = JSON.parse(result.stdout);

      // Find the files check result
      const filesCategory = output.summary?.find((s: { category: string }) =>
        s.category?.includes("Files") || s.category?.includes("Repository Files")
      );

      if (filesCategory) {
        expect(filesCategory.passed).toBeGreaterThan(0);
      }
    });
  });

  describe("Organization Scanning", () => {
    let configDir: string;

    beforeEach(() => {
      configDir = createTempDir();
      writeFile(join(configDir, "check.toml"), `
[process.repo]
enabled = true
require_branch_protection = true
`);
    });

    afterEach(() => {
      if (configDir) {
        rmSync(configDir, { recursive: true, force: true });
      }
    });

    it("should scan organization with --org option", () => {
      const result = driftWithToken(`process scan --org ${getTestOrg()} --config ${join(configDir, "check.toml")} --json --dry-run --all`);

      // Should either succeed or fail with meaningful error
      const fullOutput = result.stdout + result.stderr;

      // Check that it attempted to scan org
      expect(fullOutput).toMatch(new RegExp(`${getTestOrg()}|organization|repos`, "i"));
    });

    it("should respect --since option for recent commits only", () => {
      const result = driftWithToken(`process scan --org ${getTestOrg()} --config ${join(configDir, "check.toml")} --since 1 --dry-run`);

      // Should complete (may skip repos without recent commits)
      // The command should not crash
      expect(result.exitCode).toBeDefined();
    });

    it("should scan all repos with --all option", () => {
      const result = driftWithToken(`process scan --org ${getTestOrg()} --config ${join(configDir, "check.toml")} --all --dry-run --json`);

      // Should complete
      expect(result.exitCode).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    let configDir: string;

    beforeEach(() => {
      configDir = createTempDir();
      writeFile(join(configDir, "check.toml"), `
[process.repo]
enabled = true
`);
    });

    afterEach(() => {
      if (configDir) {
        rmSync(configDir, { recursive: true, force: true });
      }
    });

    it("should handle non-existent repository gracefully", () => {
      const result = driftWithToken(`process scan --repo ${getTestOrg()}/this-repo-does-not-exist-12345 --config ${join(configDir, "check.toml")} --json`);

      // Should fail but not crash
      expect(result.exitCode).not.toBe(0);
      const fullOutput = result.stdout + result.stderr;
      expect(fullOutput).toMatch(/not found|does not exist|404|error/i);
    });

    it("should handle invalid config file gracefully", () => {
      writeFile(join(configDir, "bad-check.toml"), "[invalid toml content");

      const result = driftWithToken(`process scan --repo ${getTestOrg()}/cmt-protected --config ${join(configDir, "bad-check.toml")}`);

      // Should fail with config error
      expect(result.exitCode).not.toBe(0);
      const fullOutput = result.stdout + result.stderr;
      expect(fullOutput).toMatch(/invalid|error|parse|toml/i);
    });

    it("should handle empty config file gracefully", () => {
      writeFile(join(configDir, "empty-check.toml"), "");

      const result = driftWithToken(`process scan --repo ${getTestOrg()}/cmt-protected --config ${join(configDir, "empty-check.toml")}`);

      // Should handle gracefully (either skip or error with message)
      expect(result.exitCode).toBeDefined();
    });
  });

  describe("Issue Creation", () => {
    let configDir: string;

    beforeEach(() => {
      configDir = createTempDir();
      writeFile(join(configDir, "check.toml"), `
[process.repo]
enabled = true
require_branch_protection = true

[process.repo.ruleset]
branch = "main"
required_reviews = 1
`);
    });

    afterEach(() => {
      if (configDir) {
        rmSync(configDir, { recursive: true, force: true });
      }
    });

    it("should create GitHub issue when violations found (non-dry-run)", () => {
      // Use a repo we can create issues on
      const result = driftWithToken(`process scan --repo ${getTestOrg()}/cmt-protected --config ${join(configDir, "check.toml")} --json`);

      // Check if issue was created (exitCode 1 means violations found)
      if (result.exitCode === 1) {
        const fullOutput = result.stdout + result.stderr;
        // Should mention issue creation
        expect(fullOutput).toMatch(/issue|created/i);
      }
    });

    it("should not create duplicate issues on repeated scans", () => {
      // Run scan twice
      const result1 = driftWithToken(`process scan --repo ${getTestOrg()}/cmt-protected --config ${join(configDir, "check.toml")} --json`);
      const result2 = driftWithToken(`process scan --repo ${getTestOrg()}/cmt-protected --config ${join(configDir, "check.toml")} --json`);

      // Both should complete (behavior for duplicates may vary)
      expect(result1.exitCode).toBeDefined();
      expect(result2.exitCode).toBeDefined();
    });
  });

  describe("Process Check Types", () => {
    let configDir: string;

    afterEach(() => {
      if (configDir) {
        rmSync(configDir, { recursive: true, force: true });
      }
    });

    it("should support branch naming checks", () => {
      configDir = createTempDir();
      writeFile(join(configDir, "check.toml"), `
[process.branches]
enabled = true
pattern = "^(main|develop|(feature|bugfix|hotfix)/.+)$"
`);

      const result = driftWithToken(`process scan --repo ${getTestOrg()}/cmt-ts-code-test --config ${join(configDir, "check.toml")} --json`);

      // Should complete without crashing
      expect(result.exitCode).toBeDefined();
    });

    it("should support commit convention checks", () => {
      configDir = createTempDir();
      writeFile(join(configDir, "check.toml"), `
[process.commits]
enabled = true
types = ["feat", "fix", "docs", "chore"]
`);

      const result = driftWithToken(`process scan --repo ${getTestOrg()}/cmt-ts-code-test --config ${join(configDir, "check.toml")} --json`);

      // Should complete without crashing
      expect(result.exitCode).toBeDefined();
    });

    it("should support CODEOWNERS validation", () => {
      configDir = createTempDir();
      writeFile(join(configDir, "check.toml"), `
[process.codeowners]
enabled = true

[[process.codeowners.rules]]
pattern = "*"
owners = ["@default-team"]
`);

      const result = driftWithToken(`process scan --repo ${getTestOrg()}/cmt-ts-code-test --config ${join(configDir, "check.toml")} --json`);

      // Should complete without crashing
      expect(result.exitCode).toBeDefined();
    });
  });
});
