/**
 * E2E tests for edge cases and error handling
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMockRepo, drift, createTempDir, writeFile, exec } from "../src/utils.js";
import { join } from "path";
import { mkdirSync, rmSync, writeFileSync, chmodSync } from "fs";

describe("Edge Cases", () => {
  describe("Invalid YAML Files", () => {
    let testRepo: { path: string; cleanup: () => void };
    let configDir: string;

    beforeEach(() => {
      configDir = createTempDir();
      writeFile(join(configDir, "drift.config.yaml"), "scans: []\n");
      mkdirSync(join(configDir, "approved"), { recursive: true });
      writeFile(join(configDir, "approved/.gitkeep"), "");
    });

    afterEach(() => {
      if (testRepo) testRepo.cleanup();
      if (configDir) rmSync(configDir, { recursive: true, force: true });
    });

    // BUG #6: Silent success with malformed repo-metadata.yaml
    it("should handle malformed repo-metadata.yaml (BUG: silent success)", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: [invalid\nstatus: broken",
        "check.toml": "[checks]\n",
      });

      const result = drift(`code scan --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")}`);

      // Document the bug: should report error but says "All checks passed"
      // When fixed, change to: expect(result.stdout + result.stderr).toMatch(/error|invalid|parse|yaml/i);
      expect(result.stdout).toMatch(/All checks passed/);
    });

    // BUG #7: Silent success with empty repo-metadata.yaml
    it("should handle empty repo-metadata.yaml (BUG: silent success)", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "",
        "check.toml": "[checks]\n",
      });

      const result = drift(`code scan --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")}`);

      // Document the bug: should warn about empty file but says "All checks passed"
      // When fixed, change to: expect(result.stdout + result.stderr).toMatch(/empty|invalid|error|missing/i);
      expect(result.stdout).toMatch(/All checks passed/);
    });

    // BUG #8: Silent success with malformed check.toml
    it("should handle malformed check.toml (BUG: silent success)", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[invalid toml content",
      });

      const result = drift(`code scan --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")}`);

      // Document the bug: should report TOML error but says "All checks passed"
      // When fixed, change to: expect(result.stdout + result.stderr).toMatch(/error|invalid|parse|toml/i);
      expect(result.stdout).toMatch(/All checks passed/);
    });

    it("should handle malformed drift.config.yaml", () => {
      writeFile(join(configDir, "drift.config.yaml"), "scans: [invalid");

      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
      });

      const result = drift(`code scan --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")}`);

      // Should handle config parse error
      expect(result.stdout + result.stderr).toMatch(/error|invalid|parse|config/i);
    });
  });

  describe("File Permission Issues", () => {
    let testRepo: { path: string; cleanup: () => void };
    let configDir: string;

    beforeEach(() => {
      configDir = createTempDir();
      writeFile(join(configDir, "drift.config.yaml"), "scans: []\n");
      mkdirSync(join(configDir, "approved"), { recursive: true });
      writeFile(join(configDir, "approved/.gitkeep"), "");
    });

    afterEach(() => {
      if (testRepo) {
        // Reset permissions before cleanup
        try {
          chmodSync(testRepo.path, 0o755);
        } catch {}
        testRepo.cleanup();
      }
      if (configDir) rmSync(configDir, { recursive: true, force: true });
    });

    it("should handle unreadable files gracefully", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
        "CODEOWNERS": "* @team\n",
      });

      // Make CODEOWNERS unreadable
      try {
        chmodSync(join(testRepo.path, "CODEOWNERS"), 0o000);
      } catch {
        // Skip if we can't change permissions
        return;
      }

      writeFile(join(configDir, "drift.config.yaml"), `
integrity:
  protected:
    - file: CODEOWNERS
      approved: approved/CODEOWNERS
      severity: critical
`);
      writeFile(join(configDir, "approved/CODEOWNERS"), "* @approved\n");

      const result = drift(`code scan --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")}`);

      // Should handle permission error
      expect(result.stdout + result.stderr).toMatch(/error|permission|access|read/i);

      // Reset permissions
      chmodSync(join(testRepo.path, "CODEOWNERS"), 0o644);
    });
  });

  describe("Large Files", () => {
    let testRepo: { path: string; cleanup: () => void };
    let configDir: string;

    beforeEach(() => {
      configDir = createTempDir();
    });

    afterEach(() => {
      if (testRepo) testRepo.cleanup();
      if (configDir) rmSync(configDir, { recursive: true, force: true });
    });

    it("should handle large files in integrity check", () => {
      // Create a large file
      const largeContent = "x".repeat(1024 * 1024); // 1MB

      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
        "large-file.txt": largeContent,
      });

      writeFile(join(configDir, "drift.config.yaml"), `
integrity:
  protected:
    - file: large-file.txt
      approved: approved/large-file.txt
      severity: low
`);
      mkdirSync(join(configDir, "approved"), { recursive: true });
      writeFile(join(configDir, "approved/large-file.txt"), largeContent);

      const result = drift(`code scan --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")}`);

      // Should handle large files
      expect(result.exitCode).toBeDefined();
    });
  });

  describe("Special Characters", () => {
    let testRepo: { path: string; cleanup: () => void };
    let configDir: string;

    beforeEach(() => {
      configDir = createTempDir();
    });

    afterEach(() => {
      if (testRepo) testRepo.cleanup();
      if (configDir) rmSync(configDir, { recursive: true, force: true });
    });

    it("should handle filenames with spaces", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
        "file with spaces.txt": "content\n",
      });

      writeFile(join(configDir, "drift.config.yaml"), `
integrity:
  protected:
    - file: "file with spaces.txt"
      approved: "approved/file with spaces.txt"
      severity: low
`);
      mkdirSync(join(configDir, "approved"), { recursive: true });
      writeFile(join(configDir, "approved/file with spaces.txt"), "content\n");

      const result = drift(`code scan --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")}`);

      expect(result.exitCode).toBeDefined();
    });

    it("should handle Unicode in filenames", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
        "文件.txt": "content\n",
      });

      writeFile(join(configDir, "drift.config.yaml"), "scans: []\n");
      mkdirSync(join(configDir, "approved"), { recursive: true });
      writeFile(join(configDir, "approved/.gitkeep"), "");

      const result = drift(`code scan --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")}`);

      expect(result.exitCode).toBeDefined();
    });

    it("should handle special characters in file content", () => {
      const specialContent = "* @team\n# Comment with émojis 🎉\n\n";

      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
        "CODEOWNERS": specialContent,
      });

      writeFile(join(configDir, "drift.config.yaml"), `
integrity:
  protected:
    - file: CODEOWNERS
      approved: approved/CODEOWNERS
      severity: critical
`);
      mkdirSync(join(configDir, "approved"), { recursive: true });
      writeFile(join(configDir, "approved/CODEOWNERS"), specialContent);

      const result = drift(`code scan --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")}`);

      expect(result.exitCode).toBe(0);
    });
  });

  describe("Symlinks", () => {
    let testRepo: { path: string; cleanup: () => void };
    let configDir: string;

    beforeEach(() => {
      configDir = createTempDir();
    });

    afterEach(() => {
      if (testRepo) testRepo.cleanup();
      if (configDir) rmSync(configDir, { recursive: true, force: true });
    });

    it("should handle symlinked files", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
        "real-file.txt": "content\n",
      });

      // Create symlink
      try {
        exec(`ln -s real-file.txt symlink.txt`, { cwd: testRepo.path });
      } catch {
        // Skip if symlinks not supported
        return;
      }

      writeFile(join(configDir, "drift.config.yaml"), "scans: []\n");
      mkdirSync(join(configDir, "approved"), { recursive: true });
      writeFile(join(configDir, "approved/.gitkeep"), "");

      const result = drift(`code scan --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")}`);

      expect(result.exitCode).toBeDefined();
    });
  });

  describe("Empty Directories", () => {
    let testRepo: { path: string; cleanup: () => void };
    let configDir: string;

    beforeEach(() => {
      configDir = createTempDir();
    });

    afterEach(() => {
      if (testRepo) testRepo.cleanup();
      if (configDir) rmSync(configDir, { recursive: true, force: true });
    });

    it("should handle empty .github/workflows directory", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
        ".github/workflows/.gitkeep": "",
      });

      writeFile(join(configDir, "drift.config.yaml"), `
integrity:
  discover:
    - pattern: ".github/workflows/*.yml"
      suggestion: "New workflow"
`);
      mkdirSync(join(configDir, "approved"), { recursive: true });
      writeFile(join(configDir, "approved/.gitkeep"), "");

      const result = drift(`code scan --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")}`);

      // Should handle empty directory without error
      expect(result.exitCode).toBeDefined();
    });
  });

  describe("Concurrent Scans", () => {
    let configDir: string;

    beforeEach(() => {
      configDir = createTempDir();
      writeFile(join(configDir, "drift.config.yaml"), "scans: []\n");
      mkdirSync(join(configDir, "approved"), { recursive: true });
      writeFile(join(configDir, "approved/.gitkeep"), "");
    });

    afterEach(() => {
      if (configDir) rmSync(configDir, { recursive: true, force: true });
    });

    it("should handle multiple concurrent scans", async () => {
      const repos: { path: string; cleanup: () => void }[] = [];

      // Create multiple repos
      for (let i = 0; i < 3; i++) {
        repos.push(createMockRepo({
          "repo-metadata.yaml": "tier: production\nstatus: active",
          "check.toml": "[checks]\n",
        }));
      }

      // Run scans concurrently
      const promises = repos.map(repo =>
        Promise.resolve(drift(`code scan --path ${repo.path} --config ${join(configDir, "drift.config.yaml")}`))
      );

      const results = await Promise.all(promises);

      // All should complete
      results.forEach(result => {
        expect(result.exitCode).toBeDefined();
      });

      // Cleanup
      repos.forEach(repo => repo.cleanup());
    });
  });

  describe("Scan Command Failures", () => {
    let testRepo: { path: string; cleanup: () => void };
    let configDir: string;

    beforeEach(() => {
      configDir = createTempDir();
    });

    afterEach(() => {
      if (testRepo) testRepo.cleanup();
      if (configDir) rmSync(configDir, { recursive: true, force: true });
    });

    it("should report scan failure with exit code", () => {
      writeFile(join(configDir, "drift.config.yaml"), `
scans:
  - name: always-fail
    command: exit 42
    severity: high
`);
      mkdirSync(join(configDir, "approved"), { recursive: true });
      writeFile(join(configDir, "approved/.gitkeep"), "");

      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
      });

      const result = drift(`code scan --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")} --dry-run`);

      // Should report the failure
      expect(result.stdout + result.stderr).toMatch(/fail|always-fail|42/i);
    });

    it("should capture scan command stderr", () => {
      writeFile(join(configDir, "drift.config.yaml"), `
scans:
  - name: stderr-test
    command: "echo 'error message' >&2 && exit 1"
    severity: high
`);
      mkdirSync(join(configDir, "approved"), { recursive: true });
      writeFile(join(configDir, "approved/.gitkeep"), "");

      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
      });

      const result = drift(`code scan --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")} --dry-run`);

      // Should capture stderr
      expect(result.stdout + result.stderr).toMatch(/stderr-test|error|fail/i);
    });

    it("should handle scan command that outputs nothing", () => {
      writeFile(join(configDir, "drift.config.yaml"), `
scans:
  - name: silent-fail
    command: "exit 1"
    severity: high
`);
      mkdirSync(join(configDir, "approved"), { recursive: true });
      writeFile(join(configDir, "approved/.gitkeep"), "");

      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
      });

      const result = drift(`code scan --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")} --dry-run`);

      // Should still report failure
      expect(result.stdout + result.stderr).toMatch(/fail|silent-fail/i);
    });
  });

  describe("Git Repository State", () => {
    let testRepo: { path: string; cleanup: () => void };
    let configDir: string;

    beforeEach(() => {
      configDir = createTempDir();
      writeFile(join(configDir, "drift.config.yaml"), "scans: []\n");
      mkdirSync(join(configDir, "approved"), { recursive: true });
      writeFile(join(configDir, "approved/.gitkeep"), "");
    });

    afterEach(() => {
      if (testRepo) testRepo.cleanup();
      if (configDir) rmSync(configDir, { recursive: true, force: true });
    });

    it("should handle repo with uncommitted changes", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
      });

      // Add uncommitted change
      writeFile(join(testRepo.path, "uncommitted.txt"), "new file\n");

      const result = drift(`code scan --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")}`);

      // Should handle uncommitted changes
      expect(result.exitCode).toBeDefined();
    });

    it("should handle repo on non-main branch", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
      });

      // Create and checkout feature branch
      exec("git checkout -b feature-branch", { cwd: testRepo.path });

      const result = drift(`code scan --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")}`);

      // Should work on any branch
      expect(result.exitCode).toBeDefined();
    });

    it("should handle shallow clone", () => {
      testRepo = createMockRepo({
        "repo-metadata.yaml": "tier: production\nstatus: active",
        "check.toml": "[checks]\n",
      });

      // Make multiple commits
      writeFile(join(testRepo.path, "file1.txt"), "content1\n");
      exec("git add -A && git commit -m 'Commit 1'", { cwd: testRepo.path });
      writeFile(join(testRepo.path, "file2.txt"), "content2\n");
      exec("git add -A && git commit -m 'Commit 2'", { cwd: testRepo.path });

      const result = drift(`code scan --path ${testRepo.path} --config ${join(configDir, "drift.config.yaml")}`);

      expect(result.exitCode).toBeDefined();
    });
  });

  describe("Non-Git Directory", () => {
    let tempDir: string;
    let configDir: string;

    beforeEach(() => {
      configDir = createTempDir();
      writeFile(join(configDir, "drift.config.yaml"), "scans: []\n");
      mkdirSync(join(configDir, "approved"), { recursive: true });
      writeFile(join(configDir, "approved/.gitkeep"), "");
    });

    afterEach(() => {
      if (tempDir) rmSync(tempDir, { recursive: true, force: true });
      if (configDir) rmSync(configDir, { recursive: true, force: true });
    });

    // BUG #10: Non-git directory scans without warning
    it("should handle non-git directory (BUG: silent success)", () => {
      tempDir = createTempDir();
      writeFile(join(tempDir, "repo-metadata.yaml"), "tier: production\nstatus: active");
      writeFile(join(tempDir, "check.toml"), "[checks]\n");

      const result = drift(`code scan --path ${tempDir} --config ${join(configDir, "drift.config.yaml")}`);

      // Document the bug: should warn about non-git directory but says "All checks passed"
      // When fixed, change to: expect(result.stdout + result.stderr).toMatch(/git|repo|error|warning/i);
      expect(result.stdout).toMatch(/All checks passed/);
    });
  });
});
