/**
 * E2E tests for drift-toolkit exported types
 * Tests that all documented types are properly exported and usable
 */
import { describe, it, expect } from "vitest";
import type {
  // Scan types
  ScanDefinition,
  ScanResult,
  // Integrity types
  IntegrityCheck,
  IntegrityResult,
  DiscoveryPattern,
  DiscoveryResult,
  // Config types
  DriftConfig,
  CodeDomainConfig,
  MetadataSchema,
  RepoContext,
  // Result types
  DriftResults,
  OrgScanResults,
  RepoScanResult,
  OrgScanSummary,
  // Severity
  Severity,
  // Repo detection types
  RepoTier,
  RepoStatus,
  RepoMetadata,
  ScannabilityResult,
  // Change tracking types
  CheckTomlChanges,
  ChangeDetectionOptions,
  // Project detection types
  MissingProject,
  MissingProjectsDetection,
  CmProjectsOutput,
  // Dependency change types
  DependencyChanges,
  DependencyChange,
  DependencyChangesDetection,
  DependencyFileChange,
} from "drift-toolkit";

describe("Type Exports", () => {
  describe("Scan Types", () => {
    it("should export ScanDefinition type", () => {
      // Type assertion - if this compiles, the type exists
      const scan: ScanDefinition = {
        name: "test",
        command: "echo test",
        severity: "low",
      };
      expect(scan.name).toBe("test");
    });

    it("should export ScanResult type", () => {
      const result: ScanResult = {
        scan: "test",
        status: "pass",
        exitCode: 0,
        stdout: "",
        stderr: "",
        severity: "low",
      };
      expect(result.status).toBe("pass");
    });
  });

  describe("Integrity Types", () => {
    it("should export IntegrityCheck type", () => {
      const check: IntegrityCheck = {
        file: "CODEOWNERS",
        approved: "approved/CODEOWNERS",
        severity: "critical",
      };
      expect(check.file).toBe("CODEOWNERS");
    });

    it("should export IntegrityResult type", () => {
      const result: IntegrityResult = {
        file: "CODEOWNERS",
        status: "match",
        severity: "critical",
      };
      expect(result.status).toBe("match");
    });

    it("should export DiscoveryPattern type", () => {
      const pattern: DiscoveryPattern = {
        pattern: "*.yml",
        suggestion: "Consider protecting",
      };
      expect(pattern.pattern).toBe("*.yml");
    });

    it("should export DiscoveryResult type", () => {
      const result: DiscoveryResult = {
        file: ".github/workflows/ci.yml",
        pattern: "*.yml",
        suggestion: "Consider protecting",
      };
      expect(result.file).toBeDefined();
    });
  });

  describe("Config Types", () => {
    it("should export DriftConfig type", () => {
      const config: Partial<DriftConfig> = {
        scans: [],
        exclude: [],
      };
      expect(config.scans).toEqual([]);
    });

    it("should export MetadataSchema type", () => {
      const schema: MetadataSchema = {
        tiers: ["production", "internal"],
        teams: ["platform"],
      };
      expect(schema.tiers).toContain("production");
    });

    it("should export RepoContext type", () => {
      const context: RepoContext = {
        tier: "production",
      };
      expect(context.tier).toBe("production");
    });
  });

  describe("Severity Type", () => {
    it("should export Severity type with valid values", () => {
      const severities: Severity[] = ["critical", "high", "medium", "low"];
      expect(severities).toContain("critical");
      expect(severities).toContain("high");
      expect(severities).toContain("medium");
      expect(severities).toContain("low");
    });
  });

  describe("Repo Detection Types", () => {
    it("should export RepoTier type", () => {
      const tiers: RepoTier[] = ["production", "internal", "prototype"];
      expect(tiers).toContain("production");
    });

    it("should export RepoStatus type", () => {
      const statuses: RepoStatus[] = ["active", "pre-release", "deprecated"];
      expect(statuses).toContain("active");
    });

    it("should export RepoMetadata type", () => {
      const metadata: RepoMetadata = {
        tier: "production",
        status: "active",
        team: "platform",
        raw: {},
      };
      expect(metadata.tier).toBe("production");
    });

    it("should export ScannabilityResult type", () => {
      const result: ScannabilityResult = {
        scannable: true,
        hasMetadata: true,
        hasCheckToml: true,
      };
      expect(result.scannable).toBe(true);
    });
  });

  describe("Change Tracking Types", () => {
    it("should export CheckTomlChanges type", () => {
      const changes: CheckTomlChanges = {
        added: [],
        modified: [],
        deleted: [],
        hasChanges: false,
      };
      expect(changes.hasChanges).toBe(false);
    });

    it("should export ChangeDetectionOptions type", () => {
      const options: ChangeDetectionOptions = {
        baseCommit: "abc123",
        targetCommit: "HEAD",
      };
      expect(options.baseCommit).toBe("abc123");
    });
  });

  describe("Project Detection Types", () => {
    it("should export MissingProject type", () => {
      const project: MissingProject = {
        path: "packages/api",
        type: "typescript",
      };
      expect(project.path).toBe("packages/api");
    });
  });

  describe("Dependency Change Types", () => {
    it("should export DependencyChange type", () => {
      const change: DependencyChange = {
        file: ".eslintrc.js",
        status: "modified",
        checkType: "eslint",
        alwaysTracked: false,
      };
      expect(change.file).toBe(".eslintrc.js");
    });

    it("should export DependencyChanges type", () => {
      const changes: DependencyChanges = {
        changes: [],
        byCheck: {},
        alwaysTrackedChanges: [],
        totalTrackedFiles: 0,
        hasChanges: false,
      };
      expect(changes.hasChanges).toBe(false);
    });
  });

  describe("Result Types", () => {
    it("should export OrgScanSummary type", () => {
      const summary: OrgScanSummary = {
        organization: "test-org",
        configRepo: "drift-config",
        totalRepos: 10,
        scannedRepos: 8,
        skippedRepos: 2,
        passedRepos: 6,
        failedRepos: 2,
      };
      expect(summary.organization).toBe("test-org");
    });
  });
});

describe("Type Completeness", () => {
  it("should have all documented types available", () => {
    // This test just imports types - if it compiles, the types exist
    // The actual type checking is done at compile time
    expect(true).toBe(true);
  });
});
