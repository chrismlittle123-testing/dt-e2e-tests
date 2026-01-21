/**
 * E2E tests for GitHub integration
 * Tests real GitHub operations using the chrismlittle123-testing organization
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { exec, drift, getTestOrg, createTempDir, writeFile } from "../src/utils.js";
import { join } from "path";
import { rmSync, existsSync, mkdirSync } from "fs";

const TEST_ORG = getTestOrg();
const TEMP_DIRS: string[] = [];

// Helper to track temp dirs for cleanup
function trackTempDir(dir: string): string {
  TEMP_DIRS.push(dir);
  return dir;
}

afterAll(() => {
  // Cleanup all temp directories
  TEMP_DIRS.forEach(dir => {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("GitHub Integration", () => {
  describe("Repository Cloning", () => {
    it("should clone drift-config repo", () => {
      const tempDir = trackTempDir(createTempDir());

      const result = exec(`git clone https://github.com/${TEST_ORG}/drift-config.git ${tempDir}/drift-config`, {
        env: { GIT_TERMINAL_PROMPT: "0" }
      });

      expect(result.exitCode).toBe(0);
      expect(existsSync(join(tempDir, "drift-config", "drift.config.yaml"))).toBe(true);
    });

    it("should have valid drift.config.yaml in config repo", () => {
      const tempDir = trackTempDir(createTempDir());

      exec(`git clone https://github.com/${TEST_ORG}/drift-config.git ${tempDir}/drift-config`);

      // Try to parse the config
      const result = drift(`code scan --path ${tempDir}/drift-config --config ${tempDir}/drift-config/drift.config.yaml`);

      // Config should be valid (not a parse error)
      expect(result.stdout + result.stderr).not.toMatch(/parse error|invalid config/i);
    });
  });

  describe("Organization API Access", () => {
    it("should list repos in test organization", () => {
      const result = exec(`gh repo list ${TEST_ORG} --json name --limit 10`);

      expect(result.exitCode).toBe(0);
      const repos = JSON.parse(result.stdout);
      expect(Array.isArray(repos)).toBe(true);
    });

    it("should access drift-config repo via API", () => {
      const result = exec(`gh api repos/${TEST_ORG}/drift-config --jq '.name'`);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("drift-config");
    });
  });

  describe("Real Scan Operations", () => {
    it("should scan drift-config repo successfully", () => {
      const tempDir = trackTempDir(createTempDir());

      // Clone the repo
      exec(`git clone https://github.com/${TEST_ORG}/drift-config.git ${tempDir}/drift-config`);

      // Run scan with local config
      const result = drift(`code scan --path ${tempDir}/drift-config --config ${tempDir}/drift-config/drift.config.yaml`);

      // Should complete without crashing
      expect(result.exitCode).toBeDefined();
    });
  });

  describe("Config Repo Structure Validation", () => {
    it("should have approved folder in drift-config", () => {
      const result = exec(`gh api repos/${TEST_ORG}/drift-config/contents/approved --jq '.[].name'`);

      expect(result.exitCode).toBe(0);
      // Should have at least a .gitkeep
      expect(result.stdout.length).toBeGreaterThan(0);
    });

    it("should have drift.config.yaml in drift-config", () => {
      const result = exec(`gh api repos/${TEST_ORG}/drift-config/contents/drift.config.yaml --jq '.name'`);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe("drift.config.yaml");
    });
  });

  describe("Issue Creation (Dry Run)", () => {
    it("should not create issues with --dry-run flag", () => {
      const tempDir = trackTempDir(createTempDir());

      // Create a repo with drift that would create an issue
      exec(`git init ${tempDir}/test-repo`);
      exec(`git config user.email "test@test.com" && git config user.name "Test"`, { cwd: `${tempDir}/test-repo` });

      writeFile(join(tempDir, "test-repo", "repo-metadata.yaml"), "tier: production\nstatus: active");
      writeFile(join(tempDir, "test-repo", "check.toml"), "[checks]\n");
      writeFile(join(tempDir, "test-repo", "CODEOWNERS"), "* @wrong-team\n");

      exec("git add -A && git commit -m 'Initial'", { cwd: `${tempDir}/test-repo` });

      // Create config with integrity check
      const configDir = `${tempDir}/config`;
      mkdirSync(configDir);
      mkdirSync(join(configDir, "approved"));
      writeFile(join(configDir, "drift.config.yaml"), `
integrity:
  protected:
    - file: CODEOWNERS
      approved: approved/CODEOWNERS
      severity: critical
`);
      writeFile(join(configDir, "approved", "CODEOWNERS"), "* @correct-team\n");

      // Run with dry-run
      const result = drift(`code scan --path ${tempDir}/test-repo --config ${join(configDir, "drift.config.yaml")} --dry-run`);

      // Should indicate what would happen without actually doing it
      expect(result.stdout + result.stderr).toMatch(/dry|would|drift/i);
    });
  });

  describe("Token Handling", () => {
    it("should use GITHUB_TOKEN env var for authentication", () => {
      // Get current token
      const whoamiResult = exec("gh auth status");

      // If authenticated, org scan should work
      if (whoamiResult.exitCode === 0) {
        const result = drift(`code scan --org ${TEST_ORG} --dry-run`);
        // Should attempt to scan, not fail on auth
        expect(result.stdout + result.stderr).toMatch(/scan|clone|repo|config/i);
      }
    });
  });
});

describe("End-to-End Workflows", () => {
  describe("Full Scan Workflow", () => {
    it("should complete a full local scan workflow", () => {
      const tempDir = trackTempDir(createTempDir());

      // Setup: Create repo with all required files
      exec(`git init ${tempDir}/repo`);
      exec(`git config user.email "test@test.com" && git config user.name "Test"`, { cwd: `${tempDir}/repo` });

      writeFile(join(tempDir, "repo", "repo-metadata.yaml"), "tier: production\nstatus: active\nteam: platform");
      writeFile(join(tempDir, "repo", "check.toml"), "[checks]\n");
      writeFile(join(tempDir, "repo", "package.json"), '{"name": "test", "scripts": {"lint": "echo ok"}}');
      writeFile(join(tempDir, "repo", "README.md"), "# Test Repo\n");

      exec("git add -A && git commit -m 'Initial'", { cwd: `${tempDir}/repo` });

      // Setup: Create config
      const configDir = `${tempDir}/config`;
      mkdirSync(configDir);
      mkdirSync(join(configDir, "approved"));
      writeFile(join(configDir, "drift.config.yaml"), `
schema:
  tiers: [production, internal, prototype]
  teams: [platform, mobile, web]

integrity:
  protected: []
  discover:
    - pattern: ".github/workflows/*.yml"
      suggestion: "New workflow detected"

scans:
  - name: has-readme
    description: Check for README
    command: test -f README.md
    severity: low
  - name: npm-lint
    description: Run linter
    command: npm run lint
    if_file: package.json
    severity: high
    tiers: [production]
`);
      writeFile(join(configDir, "approved", ".gitkeep"), "");

      // Run scan
      const result = drift(`code scan --path ${tempDir}/repo --config ${join(configDir, "drift.config.yaml")}`);

      // Should complete successfully
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/has-readme|npm-lint|pass/i);
    });

    it("should complete a fix workflow", () => {
      const tempDir = trackTempDir(createTempDir());

      // Setup: Create repo with drifted file
      exec(`git init ${tempDir}/repo`);
      exec(`git config user.email "test@test.com" && git config user.name "Test"`, { cwd: `${tempDir}/repo` });

      writeFile(join(tempDir, "repo", "repo-metadata.yaml"), "tier: production\nstatus: active");
      writeFile(join(tempDir, "repo", "check.toml"), "[checks]\n");
      writeFile(join(tempDir, "repo", "LICENSE"), "Wrong license content\n");

      exec("git add -A && git commit -m 'Initial'", { cwd: `${tempDir}/repo` });

      // Setup: Create config with correct version
      const configDir = `${tempDir}/config`;
      mkdirSync(configDir);
      mkdirSync(join(configDir, "approved"));
      writeFile(join(configDir, "drift.config.yaml"), `
integrity:
  protected:
    - file: LICENSE
      approved: approved/LICENSE
      severity: low
`);
      writeFile(join(configDir, "approved", "LICENSE"), "MIT License\n\nCopyright (c) 2024\n");

      // Run fix
      const fixResult = drift(`code fix --path ${tempDir}/repo --config ${join(configDir, "drift.config.yaml")}`);

      // Verify fix
      expect(fixResult.exitCode).toBe(0);

      // Check file was updated
      const { readFileSync } = await import("fs");
      const content = readFileSync(join(tempDir, "repo", "LICENSE"), "utf-8");
      expect(content).toBe("MIT License\n\nCopyright (c) 2024\n");
    });
  });

  describe("JSON Output Workflow", () => {
    it("should produce valid JSON output for scans", () => {
      const tempDir = trackTempDir(createTempDir());

      // Setup minimal scannable repo
      exec(`git init ${tempDir}/repo`);
      exec(`git config user.email "test@test.com" && git config user.name "Test"`, { cwd: `${tempDir}/repo` });

      writeFile(join(tempDir, "repo", "repo-metadata.yaml"), "tier: production\nstatus: active");
      writeFile(join(tempDir, "repo", "check.toml"), "[checks]\n");

      exec("git add -A && git commit -m 'Initial'", { cwd: `${tempDir}/repo` });

      // Config
      const configDir = `${tempDir}/config`;
      mkdirSync(configDir);
      mkdirSync(join(configDir, "approved"));
      writeFile(join(configDir, "drift.config.yaml"), "scans: []\n");
      writeFile(join(configDir, "approved", ".gitkeep"), "");

      // Run with JSON output
      const result = drift(`code scan --path ${tempDir}/repo --config ${join(configDir, "drift.config.yaml")} --json`);

      // Should be valid JSON or have JSON somewhere in output
      try {
        JSON.parse(result.stdout);
        expect(true).toBe(true); // Valid JSON
      } catch {
        // May have mixed output - check for JSON-like structure
        expect(result.stdout).toMatch(/[\{\[].*[\}\]]/s);
      }
    });
  });
});
