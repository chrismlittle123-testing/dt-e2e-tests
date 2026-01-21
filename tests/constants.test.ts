/**
 * E2E tests for drift-toolkit constants
 */
import { describe, it, expect } from "vitest";
import {
  TIMEOUTS,
  BUFFERS,
  DISPLAY_LIMITS,
  GITHUB_API,
  CONCURRENCY,
  DEFAULTS,
  FILE_PATTERNS,
  BRANCH_PATTERNS,
  GITHUB_ISSUES,
  WORKFLOW_PATTERNS,
} from "drift-toolkit/constants";

describe("Constants", () => {
  describe("TIMEOUTS", () => {
    it("should export scanCommand timeout", () => {
      expect(TIMEOUTS.scanCommand).toBeDefined();
      expect(typeof TIMEOUTS.scanCommand).toBe("number");
      expect(TIMEOUTS.scanCommand).toBeGreaterThan(0);
    });

    it("should export gitClone timeout", () => {
      expect(TIMEOUTS.gitClone).toBeDefined();
      expect(typeof TIMEOUTS.gitClone).toBe("number");
      expect(TIMEOUTS.gitClone).toBeGreaterThan(0);
    });
  });

  describe("BUFFERS", () => {
    it("should export scanOutput buffer size", () => {
      expect(BUFFERS.scanOutput).toBeDefined();
      expect(typeof BUFFERS.scanOutput).toBe("number");
      expect(BUFFERS.scanOutput).toBeGreaterThan(0);
    });

    it("should export diffOutput buffer size", () => {
      expect(BUFFERS.diffOutput).toBeDefined();
      expect(typeof BUFFERS.diffOutput).toBe("number");
      expect(BUFFERS.diffOutput).toBeGreaterThan(0);
    });
  });

  describe("DISPLAY_LIMITS", () => {
    it("should export diffLines limit", () => {
      expect(DISPLAY_LIMITS.diffLines).toBeDefined();
      expect(typeof DISPLAY_LIMITS.diffLines).toBe("number");
    });

    it("should export commandPreview limit", () => {
      expect(DISPLAY_LIMITS.commandPreview).toBeDefined();
      expect(typeof DISPLAY_LIMITS.commandPreview).toBe("number");
    });
  });

  describe("GITHUB_API", () => {
    it("should export baseUrl", () => {
      expect(GITHUB_API.baseUrl).toBeDefined();
      expect(typeof GITHUB_API.baseUrl).toBe("string");
    });

    it("should export version", () => {
      expect(GITHUB_API.version).toBeDefined();
    });

    it("should export perPage", () => {
      expect(GITHUB_API.perPage).toBeDefined();
      expect(typeof GITHUB_API.perPage).toBe("number");
    });
  });

  describe("CONCURRENCY", () => {
    it("should export maxRepoScans", () => {
      expect(CONCURRENCY.maxRepoScans).toBeDefined();
      expect(typeof CONCURRENCY.maxRepoScans).toBe("number");
      expect(CONCURRENCY.maxRepoScans).toBeGreaterThan(0);
    });
  });

  describe("DEFAULTS", () => {
    it("should export configRepo default", () => {
      expect(DEFAULTS.configRepo).toBeDefined();
      expect(DEFAULTS.configRepo).toBe("drift-config");
    });

    it("should export scanTimeoutSeconds", () => {
      expect(DEFAULTS.scanTimeoutSeconds).toBeDefined();
      expect(typeof DEFAULTS.scanTimeoutSeconds).toBe("number");
    });

    it("should export commitWindowHours", () => {
      expect(DEFAULTS.commitWindowHours).toBeDefined();
      expect(typeof DEFAULTS.commitWindowHours).toBe("number");
      expect(DEFAULTS.commitWindowHours).toBe(24);
    });
  });

  describe("FILE_PATTERNS", () => {
    it("should export config patterns", () => {
      expect(FILE_PATTERNS.config).toBeDefined();
      expect(Array.isArray(FILE_PATTERNS.config)).toBe(true);
    });

    it("should export metadata patterns", () => {
      expect(FILE_PATTERNS.metadata).toBeDefined();
      expect(Array.isArray(FILE_PATTERNS.metadata)).toBe(true);
    });

    it("should export checkToml pattern", () => {
      expect(FILE_PATTERNS.checkToml).toBeDefined();
      expect(FILE_PATTERNS.checkToml).toBe("check.toml");
    });
  });

  describe("BRANCH_PATTERNS", () => {
    it("should export types", () => {
      expect(BRANCH_PATTERNS.types).toBeDefined();
      expect(Array.isArray(BRANCH_PATTERNS.types)).toBe(true);
    });

    it("should export excluded patterns", () => {
      expect(BRANCH_PATTERNS.excluded).toBeDefined();
      expect(Array.isArray(BRANCH_PATTERNS.excluded)).toBe(true);
    });
  });

  describe("GITHUB_ISSUES", () => {
    it("should export maxBodyLength", () => {
      expect(GITHUB_ISSUES.maxBodyLength).toBeDefined();
      expect(typeof GITHUB_ISSUES.maxBodyLength).toBe("number");
    });

    it("should export driftLabel", () => {
      expect(GITHUB_ISSUES.driftLabel).toBeDefined();
      expect(typeof GITHUB_ISSUES.driftLabel).toBe("string");
    });

    it("should export driftTitle", () => {
      expect(GITHUB_ISSUES.driftTitle).toBeDefined();
      expect(typeof GITHUB_ISSUES.driftTitle).toBe("string");
    });
  });

  describe("WORKFLOW_PATTERNS", () => {
    it("should export workflow patterns", () => {
      expect(WORKFLOW_PATTERNS.patterns).toBeDefined();
      expect(Array.isArray(WORKFLOW_PATTERNS.patterns)).toBe(true);
      expect(WORKFLOW_PATTERNS.patterns).toContain(".github/workflows/*.yml");
    });
  });
});
