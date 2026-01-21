# drift-toolkit Issues Found

This document tracks bugs and issues discovered through E2E testing.

**Tested Version:** 1.14.1 (latest)

## Legend
- 🔴 Critical - Blocking functionality
- 🟠 High - Significant impact
- 🟡 Medium - Notable issue
- 🟢 Low - Minor issue

---

## Issues

### 1. 🔴 Constants Export Path Does Not Exist

**Test:** `tests/constants.test.ts`
**Expected:** `drift-toolkit/constants` should be importable as documented in FEATURES.md
**Actual:** Import fails with "ERR_MODULE_NOT_FOUND" error
**Impact:** Documented API for constants is not accessible
**GitHub Issue:** https://github.com/chrismlittle123/drift-toolkit/issues/89

```typescript
// This fails:
import { TIMEOUTS, DEFAULTS } from "drift-toolkit/constants";
```

---

### 2. 🟠 `getRepoMetadata` Returns Null Instead of Object

**Test:** `tests/library-api.test.ts > should handle missing metadata file`
**Expected:** When metadata file is missing, should return `{ metadata: null, warnings: [] }`
**Actual:** Returns `null` directly, causing `TypeError: Cannot read properties of null`
**Impact:** Inconsistent API behavior, potential runtime crashes

```typescript
// Expected behavior per FEATURES.md:
const result = getRepoMetadata("/path/without/metadata");
// Should return: { metadata: null, warnings: [] }
// Actually returns: null
```

---

### 3. 🟠 `discoverFiles` Does Not Exclude Already Protected Files

**Test:** `tests/library-api.test.ts > should exclude already protected files`
**Expected:** Files passed in the "already protected" array should not appear in discovery results
**Actual:** Protected files are still included in the discovered array
**Impact:** Duplicate/incorrect discovery results

```typescript
const discovered = discoverFiles(
  [{ pattern: ".github/workflows/*.yml", suggestion: "Consider protecting" }],
  repoPath,
  [".github/workflows/ci.yml"] // Should be excluded
);
// ci.yml is still in discovered array
```

---

### 4. 🟠 Silent Success When repo-metadata.yaml Is Missing

**Test:** `tests/cli-scan.test.ts > should fail if repo-metadata.yaml is missing`
**Expected:** Scan should warn or indicate repo is not scannable
**Actual:** Reports "All checks passed" with no warning
**Impact:** Users won't know their repos are missing required metadata

```bash
$ drift code scan --path /repo-without-metadata
# Output: "✓ All checks passed"
# Expected: Warning about missing metadata
```

---

### 5. 🟠 Silent Success When check.toml Is Missing

**Test:** `tests/cli-scan.test.ts > should fail if check.toml is missing`
**Expected:** Scan should warn or indicate repo is not scannable
**Actual:** Reports "All checks passed" with no warning
**Impact:** Users won't know their repos are missing required configuration

```bash
$ drift code scan --path /repo-without-check-toml
# Output: "✓ All checks passed"
# Expected: Warning about missing check.toml
```

---

### 6. 🟠 Silent Success With Malformed repo-metadata.yaml

**Test:** `tests/edge-cases.test.ts > should handle malformed repo-metadata.yaml`
**Expected:** Should report YAML parse error or validation warning
**Actual:** Reports "All checks passed" silently
**Impact:** Invalid metadata goes undetected

```yaml
# Invalid YAML:
tier: [invalid
status: broken
```

---

### 7. 🟡 Silent Success With Empty repo-metadata.yaml

**Test:** `tests/edge-cases.test.ts > should handle empty repo-metadata.yaml`
**Expected:** Should warn about empty/missing required fields
**Actual:** Reports "All checks passed" silently
**Impact:** Empty metadata files go undetected

---

### 8. 🟡 Silent Success With Malformed check.toml

**Test:** `tests/edge-cases.test.ts > should handle malformed check.toml`
**Expected:** Should report TOML parse error
**Actual:** Reports "All checks passed" silently
**Impact:** Invalid TOML configuration goes undetected

```toml
[invalid toml content
```

---

### 9. 🟡 Non-Existent Repo Shows "Skipped" Instead of "Not Found"

**Test:** `tests/org-scanning.test.ts > should fail when repo does not exist`
**Expected:** Should report "repo not found" or similar error
**Actual:** Shows "skipped (missing required files)"
**Impact:** Misleading error message - users may think repo exists but lacks files

```bash
$ drift code scan --org myorg --repo nonexistent-repo
# Output: "○ skipped (missing required files)"
# Expected: "✗ repo not found"
```

---

### 10. 🟢 Non-Git Directory Scans Without Warning

**Test:** `tests/edge-cases.test.ts > should handle non-git directory`
**Expected:** Should warn that directory is not a git repository
**Actual:** Reports "All checks passed" without any git-related warning
**Impact:** May miss git-dependent features; confusing behavior

---

### 11. 🟠 EACCES Error Not Handled Gracefully

**Observed During Tests:**
When a file has no read permissions, drift-toolkit throws an unhandled EACCES error instead of catching and reporting it gracefully.

```
Error: EACCES: permission denied, open '.../CODEOWNERS'
```

**Impact:** Crashes instead of graceful error handling

---

### 12. 🟡 `runScan` Result Missing `stderr` Property

**Test:** `tests/scanning-api.test.ts > should capture stderr from scan`
**Expected:** Per FEATURES.md, `ScanResult` should include `stderr` property
**Actual:** `result.stderr` is `undefined`
**Impact:** Cannot capture error output from scans

```typescript
const result = runScan({ name: "test", command: "echo 'error' >&2", severity: "low" }, path);
// result.stderr is undefined
```

---

### 13. 🟡 `runScan` Result Missing `severity` Property

**Test:** `tests/scanning-api.test.ts > should include severity in result`
**Expected:** Per FEATURES.md, `ScanResult` should include `severity` property
**Actual:** `result.severity` is `undefined`
**Impact:** Cannot determine scan severity from result

```typescript
const result = runScan({ name: "test", command: "echo 'test'", severity: "critical" }, path);
// result.severity is undefined (expected "critical")
```

---

### 14. 🟠 Missing Exports: detectDependencyChanges and getTrackedDependencyFiles

**Test:** `tests/dependency-detection.test.ts`
**Expected:** Per FEATURES.md, these functions should be exported
**Actual:** Neither function is exported from drift-toolkit
**Impact:** Documented API for dependency change detection is not accessible

```typescript
// These are documented in FEATURES.md but fail:
import { detectDependencyChanges, getTrackedDependencyFiles } from "drift-toolkit";
// Result: undefined (not exported)
```

---

### 15. 🔴 Org Scanning Fails to Find Config Repo

**Test:** `tests/org-scanning.test.ts > Pre-Clone Filtering`
**Expected:** Organization scanning should find and use `drift-config` repo
**Actual:** Always returns "Config repo not found" even when repo exists with correct structure
**Impact:** **BLOCKING** - All organization-level scanning is non-functional

**Verified Conditions:**
- Config repo `chrismlittle123-testing/drift-config` exists
- Repo is public
- Contains `drift.config.yaml` at root
- Contains `approved/` directory with files
- Accessible via GitHub API and git clone

```bash
$ drift code scan --org chrismlittle123-testing --all
# Output: "Error: Config repo chrismlittle123-testing/drift-config not found.
#          Create a 'drift-config' repo with drift.config.yaml and approved/ folder."

# Even with explicit --config-repo flag:
$ drift code scan --org chrismlittle123-testing --config-repo drift-config --all
# Same error

# But the repo exists and is accessible:
$ gh api repos/chrismlittle123-testing/drift-config --jq '.name'
# Output: drift-config
```

**Note:** This bug blocks testing of several other features:
- Smart scanning (only recent commits)
- Pre-clone filtering
- Single repo scanning via --repo flag
- Exclusion patterns

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 2 |
| 🟠 High | 7 |
| 🟡 Medium | 5 |
| 🟢 Low | 1 |
| **Total** | **15** |

---

*Last updated: 2026-01-21*
*Tested version: drift-toolkit@1.14.1*
