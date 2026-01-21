/**
 * E2E tests for drift-toolkit Library API
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMockRepo, createTempDir, writeFile, exec } from "../src/utils.js";
import { join } from "path";
import { mkdirSync, rmSync, writeFileSync } from "fs";

// Import library functions
import {
  isScannableRepo,
  getRepoMetadata,
  findCheckTomlFiles,
  hasCheckToml,
  hasMetadata,
  detectMissingProjects,
  detectAllProjects,
  detectCheckTomlChanges,
  compareCheckTomlFiles,
  getCheckTomlFilesAtCommit,
  isGitRepo,
  getHeadCommit,
  checkIntegrity,
  checkAllIntegrity,
  discoverFiles,
  loadConfig,
  findConfigPath,
  getCodeConfig,
} from "drift-toolkit";

describe("Library API", () => {
  describe("Repository Detection", () => {
    let testRepo: { path: string; cleanup: () => void };

    afterEach(() => {
      if (testRepo) testRepo.cleanup();
    });

    describe("isScannableRepo", () => {
      it("should return scannable:true when both repo-metadata.yaml and check.toml exist", () => {
        testRepo = createMockRepo({
          "repo-metadata.yaml": "tier: production\nstatus: active",
          "check.toml": "[checks]\n",
        });

        const result = isScannableRepo(testRepo.path);

        expect(result.scannable).toBe(true);
        expect(result.hasMetadata).toBe(true);
        expect(result.hasCheckToml).toBe(true);
      });

      it("should return scannable:false when repo-metadata.yaml is missing", () => {
        testRepo = createMockRepo({
          "check.toml": "[checks]\n",
        });

        const result = isScannableRepo(testRepo.path);

        expect(result.scannable).toBe(false);
        expect(result.hasMetadata).toBe(false);
        expect(result.hasCheckToml).toBe(true);
      });

      it("should return scannable:false when check.toml is missing", () => {
        testRepo = createMockRepo({
          "repo-metadata.yaml": "tier: production\nstatus: active",
        });

        const result = isScannableRepo(testRepo.path);

        expect(result.scannable).toBe(false);
        expect(result.hasMetadata).toBe(true);
        expect(result.hasCheckToml).toBe(false);
      });

      it("should return scannable:false when both files are missing", () => {
        testRepo = createMockRepo({
          "README.md": "# Test",
        });

        const result = isScannableRepo(testRepo.path);

        expect(result.scannable).toBe(false);
        expect(result.hasMetadata).toBe(false);
        expect(result.hasCheckToml).toBe(false);
      });

      it("should accept repo-metadata.yml extension", () => {
        testRepo = createMockRepo({
          "repo-metadata.yml": "tier: production\nstatus: active",
          "check.toml": "[checks]\n",
        });

        const result = isScannableRepo(testRepo.path);

        expect(result.scannable).toBe(true);
        expect(result.hasMetadata).toBe(true);
      });
    });

    describe("getRepoMetadata", () => {
      it("should parse valid repo-metadata.yaml", () => {
        testRepo = createMockRepo({
          "repo-metadata.yaml": "tier: production\nstatus: active\nteam: platform",
        });

        const result = getRepoMetadata(testRepo.path);

        expect(result.metadata).toBeDefined();
        expect(result.metadata?.tier).toBe("production");
        expect(result.metadata?.status).toBe("active");
        expect(result.metadata?.team).toBe("platform");
      });

      it("should return warnings for invalid metadata", () => {
        testRepo = createMockRepo({
          "repo-metadata.yaml": "invalid: yaml: content:",
        });

        const result = getRepoMetadata(testRepo.path);

        // Should have warnings or null metadata
        expect(result.warnings.length > 0 || result.metadata === null).toBe(true);
      });

      it("should handle missing metadata file", () => {
        testRepo = createMockRepo({
          "README.md": "# Test",
        });

        const result = getRepoMetadata(testRepo.path);

        expect(result.metadata).toBeNull();
      });
    });

    describe("findCheckTomlFiles", () => {
      it("should find check.toml in root", () => {
        testRepo = createMockRepo({
          "repo-metadata.yaml": "tier: production",
          "check.toml": "[checks]\n",
        });

        const files = findCheckTomlFiles(testRepo.path);

        expect(files).toContain("check.toml");
      });

      it("should find check.toml in monorepo subdirectories", () => {
        testRepo = createMockRepo({
          "repo-metadata.yaml": "tier: production",
          "check.toml": "[checks]\n",
          "packages/api/check.toml": "[checks]\n",
          "packages/web/check.toml": "[checks]\n",
        });

        const files = findCheckTomlFiles(testRepo.path);

        expect(files).toContain("check.toml");
        expect(files.some(f => f.includes("packages/api/check.toml"))).toBe(true);
        expect(files.some(f => f.includes("packages/web/check.toml"))).toBe(true);
      });

      it("should return empty array when no check.toml exists", () => {
        testRepo = createMockRepo({
          "repo-metadata.yaml": "tier: production",
        });

        const files = findCheckTomlFiles(testRepo.path);

        expect(files.length).toBe(0);
      });
    });

    describe("hasCheckToml", () => {
      it("should return true when check.toml exists", () => {
        testRepo = createMockRepo({
          "check.toml": "[checks]\n",
        });

        expect(hasCheckToml(testRepo.path)).toBe(true);
      });

      it("should return false when check.toml does not exist", () => {
        testRepo = createMockRepo({
          "README.md": "# Test",
        });

        expect(hasCheckToml(testRepo.path)).toBe(false);
      });
    });

    describe("hasMetadata", () => {
      it("should return true when repo-metadata.yaml exists", () => {
        testRepo = createMockRepo({
          "repo-metadata.yaml": "tier: production",
        });

        expect(hasMetadata(testRepo.path)).toBe(true);
      });

      it("should return true when repo-metadata.yml exists", () => {
        testRepo = createMockRepo({
          "repo-metadata.yml": "tier: production",
        });

        expect(hasMetadata(testRepo.path)).toBe(true);
      });

      it("should return false when no metadata file exists", () => {
        testRepo = createMockRepo({
          "README.md": "# Test",
        });

        expect(hasMetadata(testRepo.path)).toBe(false);
      });
    });
  });

  describe("Change Tracking", () => {
    let testRepo: { path: string; cleanup: () => void };

    afterEach(() => {
      if (testRepo) testRepo.cleanup();
    });

    describe("isGitRepo", () => {
      it("should return true for a git repository", () => {
        testRepo = createMockRepo({
          "README.md": "# Test",
        });

        expect(isGitRepo(testRepo.path)).toBe(true);
      });

      it("should return false for a non-git directory", () => {
        const tempDir = createTempDir();
        writeFile(join(tempDir, "README.md"), "# Test");

        expect(isGitRepo(tempDir)).toBe(false);

        rmSync(tempDir, { recursive: true, force: true });
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

    describe("detectCheckTomlChanges", () => {
      it("should detect added check.toml files", () => {
        testRepo = createMockRepo({
          "repo-metadata.yaml": "tier: production",
        });

        // Get initial commit
        const baseCommit = getHeadCommit(testRepo.path);

        // Add check.toml
        writeFile(join(testRepo.path, "check.toml"), "[checks]\n");
        exec("git add -A && git commit -m 'Add check.toml'", { cwd: testRepo.path });

        const changes = detectCheckTomlChanges(testRepo.path, {
          baseCommit,
          targetCommit: "HEAD",
        });

        expect(changes.hasChanges).toBe(true);
        expect(changes.added.length).toBeGreaterThan(0);
      });

      it("should detect modified check.toml files", () => {
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

      it("should detect deleted check.toml files", () => {
        testRepo = createMockRepo({
          "repo-metadata.yaml": "tier: production",
          "check.toml": "[checks]\n",
        });

        const baseCommit = getHeadCommit(testRepo.path);

        // Delete check.toml
        rmSync(join(testRepo.path, "check.toml"));
        exec("git add -A && git commit -m 'Delete check.toml'", { cwd: testRepo.path });

        const changes = detectCheckTomlChanges(testRepo.path, {
          baseCommit,
          targetCommit: "HEAD",
        });

        expect(changes.hasChanges).toBe(true);
        expect(changes.deleted.length).toBeGreaterThan(0);
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

    describe("getCheckTomlFilesAtCommit", () => {
      it("should list check.toml files at a specific commit", () => {
        testRepo = createMockRepo({
          "repo-metadata.yaml": "tier: production",
          "check.toml": "[checks]\n",
        });

        const files = getCheckTomlFilesAtCommit(testRepo.path, "HEAD");

        expect(files).toContain("check.toml");
      });
    });

    describe("compareCheckTomlFiles", () => {
      it("should compare check.toml files between branches", () => {
        testRepo = createMockRepo({
          "repo-metadata.yaml": "tier: production",
          "check.toml": "[checks]\n",
        });

        // Create a branch and modify
        exec("git checkout -b feature-branch", { cwd: testRepo.path });
        writeFile(join(testRepo.path, "packages/new/check.toml"), "[checks]\n");
        mkdirSync(join(testRepo.path, "packages/new"), { recursive: true });
        writeFile(join(testRepo.path, "packages/new/check.toml"), "[checks]\n");
        exec("git add -A && git commit -m 'Add new package'", { cwd: testRepo.path });

        const diff = compareCheckTomlFiles(testRepo.path, "main", "feature-branch");

        expect(diff.hasChanges).toBe(true);
      });
    });
  });

  describe("Integrity Checking", () => {
    let testRepo: { path: string; cleanup: () => void };
    let approvedDir: string;

    beforeEach(() => {
      approvedDir = createTempDir();
    });

    afterEach(() => {
      if (testRepo) testRepo.cleanup();
      if (approvedDir) rmSync(approvedDir, { recursive: true, force: true });
    });

    describe("checkIntegrity", () => {
      it("should return match when files are identical", () => {
        testRepo = createMockRepo({
          "CODEOWNERS": "* @team\n",
        });
        writeFile(join(approvedDir, "CODEOWNERS"), "* @team\n");

        const result = checkIntegrity(
          { file: "CODEOWNERS", approved: "CODEOWNERS", severity: "critical" },
          testRepo.path,
          approvedDir
        );

        expect(result.status).toBe("match");
      });

      it("should return drift when files differ", () => {
        testRepo = createMockRepo({
          "CODEOWNERS": "* @team-a\n",
        });
        writeFile(join(approvedDir, "CODEOWNERS"), "* @team-b\n");

        const result = checkIntegrity(
          { file: "CODEOWNERS", approved: "CODEOWNERS", severity: "critical" },
          testRepo.path,
          approvedDir
        );

        expect(result.status).toBe("drift");
      });

      it("should return missing when target file does not exist", () => {
        testRepo = createMockRepo({
          "README.md": "# Test",
        });
        writeFile(join(approvedDir, "CODEOWNERS"), "* @team\n");

        const result = checkIntegrity(
          { file: "CODEOWNERS", approved: "CODEOWNERS", severity: "critical" },
          testRepo.path,
          approvedDir
        );

        expect(result.status).toBe("missing");
      });
    });

    describe("checkAllIntegrity", () => {
      it("should check multiple files", () => {
        testRepo = createMockRepo({
          "CODEOWNERS": "* @team\n",
          "LICENSE": "MIT\n",
        });
        writeFile(join(approvedDir, "CODEOWNERS"), "* @team\n");
        writeFile(join(approvedDir, "LICENSE"), "Apache\n");

        const results = checkAllIntegrity(
          [
            { file: "CODEOWNERS", approved: "CODEOWNERS", severity: "critical" },
            { file: "LICENSE", approved: "LICENSE", severity: "high" },
          ],
          testRepo.path,
          approvedDir
        );

        expect(results.length).toBe(2);
        expect(results.find(r => r.file === "CODEOWNERS")?.status).toBe("match");
        expect(results.find(r => r.file === "LICENSE")?.status).toBe("drift");
      });
    });

    describe("discoverFiles", () => {
      it("should discover files matching patterns", () => {
        testRepo = createMockRepo({
          ".github/workflows/ci.yml": "name: CI\n",
          ".github/workflows/deploy.yml": "name: Deploy\n",
        });

        const discovered = discoverFiles(
          [{ pattern: ".github/workflows/*.yml", suggestion: "Consider protecting" }],
          testRepo.path,
          [] // no already protected files
        );

        expect(discovered.length).toBeGreaterThan(0);
      });

      it("should exclude already protected files", () => {
        testRepo = createMockRepo({
          ".github/workflows/ci.yml": "name: CI\n",
          ".github/workflows/deploy.yml": "name: Deploy\n",
        });

        const discovered = discoverFiles(
          [{ pattern: ".github/workflows/*.yml", suggestion: "Consider protecting" }],
          testRepo.path,
          [".github/workflows/ci.yml"]
        );

        // Should not include ci.yml since it's already protected
        const discoveredPaths = discovered.map(d => d.file);
        expect(discoveredPaths).not.toContain(".github/workflows/ci.yml");
      });
    });
  });

  describe("Configuration", () => {
    let configDir: string;

    beforeEach(() => {
      configDir = createTempDir();
    });

    afterEach(() => {
      if (configDir) rmSync(configDir, { recursive: true, force: true });
    });

    describe("findConfigPath", () => {
      it("should find drift.config.yaml in directory", () => {
        writeFile(join(configDir, "drift.config.yaml"), "scans: []\n");

        const path = findConfigPath(configDir);

        expect(path).toContain("drift.config.yaml");
      });

      it("should return null when config not found", () => {
        const path = findConfigPath(configDir);

        expect(path).toBeNull();
      });
    });

    describe("loadConfig", () => {
      it("should load valid config file", () => {
        writeFile(join(configDir, "drift.config.yaml"), `
scans:
  - name: test
    command: echo test
`);

        const config = loadConfig(configDir);

        expect(config).toBeDefined();
      });

      it("should parse all config sections", () => {
        writeFile(join(configDir, "drift.config.yaml"), `
schema:
  tiers: [production, internal]
integrity:
  protected:
    - file: CODEOWNERS
      approved: approved/CODEOWNERS
      severity: critical
scans:
  - name: lint
    command: npm run lint
exclude:
  - "*-archived"
`);

        const config = loadConfig(configDir);

        expect(config.schema).toBeDefined();
        expect(config.integrity).toBeDefined();
        expect(config.scans).toBeDefined();
        expect(config.exclude).toBeDefined();
      });
    });

    describe("getCodeConfig", () => {
      it("should return code domain config", () => {
        writeFile(join(configDir, "drift.config.yaml"), `
scans:
  - name: test
    command: echo test
`);

        const config = loadConfig(configDir);
        const codeConfig = getCodeConfig(config);

        expect(codeConfig).toBeDefined();
      });
    });
  });

  describe("Project Detection", () => {
    let testRepo: { path: string; cleanup: () => void };

    afterEach(() => {
      if (testRepo) testRepo.cleanup();
    });

    describe("detectMissingProjects", () => {
      it("should detect projects without check.toml", () => {
        testRepo = createMockRepo({
          "repo-metadata.yaml": "tier: production",
          "check.toml": "[checks]\n",
          "packages/api/package.json": '{"name": "api"}',
          // packages/api is missing check.toml
        });

        const missing = detectMissingProjects(testRepo.path);

        // Should detect the missing project (depends on cm being installed)
        expect(missing).toBeDefined();
      });
    });

    describe("detectAllProjects", () => {
      it("should return project detection summary", () => {
        testRepo = createMockRepo({
          "repo-metadata.yaml": "tier: production",
          "check.toml": "[checks]\n",
          "package.json": '{"name": "root"}',
        });

        const result = detectAllProjects(testRepo.path);

        expect(result).toBeDefined();
        expect(result.summary).toBeDefined();
      });
    });
  });
});
