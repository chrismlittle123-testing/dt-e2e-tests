/**
 * E2E tests for `drift code fix` CLI command
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMockRepo, drift, createTempDir, writeFile, readFile } from "../src/utils.js";
import { join } from "path";
import { mkdirSync, rmSync, readFileSync } from "fs";

describe("drift code fix", () => {
  let testRepo: { path: string; cleanup: () => void };
  let configDir: string;

  beforeEach(() => {
    configDir = createTempDir();
  });

  afterEach(() => {
    if (testRepo) testRepo.cleanup();
    if (configDir) rmSync(configDir, { recursive: true, force: true });
  });

  describe("Basic Fix Operations", () => {
    it("should fix drifted files by syncing from approved sources", () => {
      // Set up config with integrity check
      writeFile(join(configDir, "drift.config.yaml"), `
integrity:
  protected:
    - file: CODEOWNERS
      approved: approved/CODEOWNERS
      severity: critical
`);
      mkdirSync(join(configDir, "approved"), { recursive: true });
      writeFile(join(configDir, "approved/CODEOWNERS"), "* @approved-team\n");

      // Create repo with different CODEOWNERS
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
        "CODEOWNERS": "* @different-team\n",
      });

      // Run fix
      const result = drift(`code fix --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")}`);

      // Verify file was fixed
      const content = readFileSync(join(testRepo.path, "CODEOWNERS"), "utf-8");
      expect(content).toBe("* @approved-team\n");
    });

    it("should show what would be fixed with --dry-run", () => {
      writeFile(join(configDir, "drift.config.yaml"), `
integrity:
  protected:
    - file: CODEOWNERS
      approved: approved/CODEOWNERS
      severity: critical
`);
      mkdirSync(join(configDir, "approved"), { recursive: true });
      writeFile(join(configDir, "approved/CODEOWNERS"), "* @approved-team\n");

      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
        "CODEOWNERS": "* @different-team\n",
      });

      // Run dry-run fix
      const result = drift(`code fix --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")} --dry-run`);

      // Verify file was NOT changed
      const content = readFileSync(join(testRepo.path, "CODEOWNERS"), "utf-8");
      expect(content).toBe("* @different-team\n");

      // Should indicate what would be fixed
      expect(result.stdout + result.stderr).toMatch(/CODEOWNERS|would|fix|dry/i);
    });

    it("should fix a specific file with --file option", () => {
      writeFile(join(configDir, "drift.config.yaml"), `
integrity:
  protected:
    - file: CODEOWNERS
      approved: approved/CODEOWNERS
      severity: critical
    - file: .github/workflows/ci.yml
      approved: approved/ci.yml
      severity: high
`);
      mkdirSync(join(configDir, "approved"), { recursive: true });
      writeFile(join(configDir, "approved/CODEOWNERS"), "* @approved-team\n");
      mkdirSync(join(configDir, "approved"), { recursive: true });
      writeFile(join(configDir, "approved/ci.yml"), "name: CI\non: push\njobs: {}\n");

      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
        "CODEOWNERS": "* @different-team\n",
        ".github/workflows/ci.yml": "name: Different\n",
      });

      // Fix only CODEOWNERS
      const result = drift(`code fix --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")} --file CODEOWNERS`);

      // Verify CODEOWNERS was fixed
      const codeowners = readFileSync(join(testRepo.path, "CODEOWNERS"), "utf-8");
      expect(codeowners).toBe("* @approved-team\n");

      // Verify ci.yml was NOT fixed
      const ciYml = readFileSync(join(testRepo.path, ".github/workflows/ci.yml"), "utf-8");
      expect(ciYml).toBe("name: Different\n");
    });

    it("should create missing files during fix", () => {
      writeFile(join(configDir, "drift.config.yaml"), `
integrity:
  protected:
    - file: CODEOWNERS
      approved: approved/CODEOWNERS
      severity: critical
`);
      mkdirSync(join(configDir, "approved"), { recursive: true });
      writeFile(join(configDir, "approved/CODEOWNERS"), "* @approved-team\n");

      // Repo without CODEOWNERS
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
      });

      // Run fix
      const result = drift(`code fix --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")}`);

      // Verify file was created
      const content = readFileSync(join(testRepo.path, "CODEOWNERS"), "utf-8");
      expect(content).toBe("* @approved-team\n");
    });

    it("should handle nested file paths", () => {
      writeFile(join(configDir, "drift.config.yaml"), `
integrity:
  protected:
    - file: .github/workflows/ci.yml
      approved: approved/ci.yml
      severity: high
`);
      mkdirSync(join(configDir, "approved"), { recursive: true });
      writeFile(join(configDir, "approved/ci.yml"), "name: CI\non: push\n");

      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
        ".github/workflows/ci.yml": "name: Different\n",
      });

      // Run fix
      const result = drift(`code fix --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")}`);

      // Verify file was fixed
      const content = readFileSync(join(testRepo.path, ".github/workflows/ci.yml"), "utf-8");
      expect(content).toBe("name: CI\non: push\n");
    });
  });

  describe("Fix Edge Cases", () => {
    it("should handle files that already match approved version", () => {
      writeFile(join(configDir, "drift.config.yaml"), `
integrity:
  protected:
    - file: CODEOWNERS
      approved: approved/CODEOWNERS
      severity: critical
`);
      mkdirSync(join(configDir, "approved"), { recursive: true });
      writeFile(join(configDir, "approved/CODEOWNERS"), "* @approved-team\n");

      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
        "CODEOWNERS": "* @approved-team\n",
      });

      // Run fix - should succeed with nothing to fix
      const result = drift(`code fix --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")}`);

      expect(result.exitCode).toBe(0);
    });

    it("should handle empty approved file", () => {
      writeFile(join(configDir, "drift.config.yaml"), `
integrity:
  protected:
    - file: CODEOWNERS
      approved: approved/CODEOWNERS
      severity: critical
`);
      mkdirSync(join(configDir, "approved"), { recursive: true });
      writeFile(join(configDir, "approved/CODEOWNERS"), "");

      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
        "CODEOWNERS": "* @some-team\n",
      });

      const result = drift(`code fix --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")}`);

      // Should fix to empty file
      const content = readFileSync(join(testRepo.path, "CODEOWNERS"), "utf-8");
      expect(content).toBe("");
    });

    it("should handle missing approved file gracefully", () => {
      writeFile(join(configDir, "drift.config.yaml"), `
integrity:
  protected:
    - file: CODEOWNERS
      approved: approved/CODEOWNERS
      severity: critical
`);
      mkdirSync(join(configDir, "approved"), { recursive: true });
      // Don't create approved/CODEOWNERS

      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
        "CODEOWNERS": "* @some-team\n",
      });

      const result = drift(`code fix --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")}`);

      // Should handle gracefully (error or skip)
      expect(result.stdout + result.stderr).toMatch(/approved|not found|error|skip/i);
    });

    it("should fix multiple files at once", () => {
      writeFile(join(configDir, "drift.config.yaml"), `
integrity:
  protected:
    - file: CODEOWNERS
      approved: approved/CODEOWNERS
      severity: critical
    - file: LICENSE
      approved: approved/LICENSE
      severity: high
    - file: CONTRIBUTING.md
      approved: approved/CONTRIBUTING.md
      severity: medium
`);
      mkdirSync(join(configDir, "approved"), { recursive: true });
      writeFile(join(configDir, "approved/CODEOWNERS"), "* @approved\n");
      writeFile(join(configDir, "approved/LICENSE"), "MIT License\n");
      writeFile(join(configDir, "approved/CONTRIBUTING.md"), "# Contributing\n");

      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
        "CODEOWNERS": "* @wrong\n",
        "LICENSE": "Apache\n",
        "CONTRIBUTING.md": "# Wrong\n",
      });

      const result = drift(`code fix --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")}`);

      // Verify all files were fixed
      expect(readFileSync(join(testRepo.path, "CODEOWNERS"), "utf-8")).toBe("* @approved\n");
      expect(readFileSync(join(testRepo.path, "LICENSE"), "utf-8")).toBe("MIT License\n");
      expect(readFileSync(join(testRepo.path, "CONTRIBUTING.md"), "utf-8")).toBe("# Contributing\n");
    });
  });

  describe("Fix with Different Severities", () => {
    it("should fix critical severity files", () => {
      writeFile(join(configDir, "drift.config.yaml"), `
integrity:
  protected:
    - file: SECURITY.md
      approved: approved/SECURITY.md
      severity: critical
`);
      mkdirSync(join(configDir, "approved"), { recursive: true });
      writeFile(join(configDir, "approved/SECURITY.md"), "# Security Policy\n");

      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
        "SECURITY.md": "# Wrong\n",
      });

      const result = drift(`code fix --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")}`);

      expect(readFileSync(join(testRepo.path, "SECURITY.md"), "utf-8")).toBe("# Security Policy\n");
    });

    it("should fix low severity files", () => {
      writeFile(join(configDir, "drift.config.yaml"), `
integrity:
  protected:
    - file: .editorconfig
      approved: approved/.editorconfig
      severity: low
`);
      mkdirSync(join(configDir, "approved"), { recursive: true });
      writeFile(join(configDir, "approved/.editorconfig"), "root = true\n");

      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
        ".editorconfig": "root = false\n",
      });

      const result = drift(`code fix --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")}`);

      expect(readFileSync(join(testRepo.path, ".editorconfig"), "utf-8")).toBe("root = true\n");
    });
  });

  describe("Fix with Current Directory", () => {
    it("should fix files in current directory by default", () => {
      writeFile(join(configDir, "drift.config.yaml"), `
integrity:
  protected:
    - file: CODEOWNERS
      approved: approved/CODEOWNERS
      severity: critical
`);
      mkdirSync(join(configDir, "approved"), { recursive: true });
      writeFile(join(configDir, "approved/CODEOWNERS"), "* @approved-team\n");

      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
        "CODEOWNERS": "* @different-team\n",
      });

      // Run from the repo directory
      const result = drift(`code fix --config ${join(configDir, "drift.config.yaml")}`, { cwd: testRepo.path });

      // Verify file was fixed
      const content = readFileSync(join(testRepo.path, "CODEOWNERS"), "utf-8");
      expect(content).toBe("* @approved-team\n");
    });
  });
});
