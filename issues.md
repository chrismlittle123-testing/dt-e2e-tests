# drift-toolkit Issues Found

This document tracks bugs and issues discovered through E2E testing.

**Tested Version:** 3.4.3

## Legend
- 🔴 Critical - Blocking functionality
- 🟠 High - Significant impact
- 🟡 Medium - Notable issue
- 🟢 Low - Minor issue

---

## Critical

### 1. 🔴 Constants Export Path Does Not Exist

**GitHub Issue:** https://github.com/chrismlittle123/drift-toolkit/issues/89

```typescript
import { TIMEOUTS, DEFAULTS } from "drift-toolkit/constants";
// Error: ERR_MODULE_NOT_FOUND
```

---

## High

### 2. 🟠 Silent Success When repo-metadata.yaml Is Missing

**GitHub Issue:** https://github.com/chrismlittle123/drift-toolkit/issues/93

```bash
$ drift code scan --path /repo-without-metadata
# Output: "✓ All checks passed"
# Expected: Warning about missing metadata
```

---

### 3. 🟠 Silent Success When check.toml Is Missing

**GitHub Issue:** https://github.com/chrismlittle123/drift-toolkit/issues/94

```bash
$ drift code scan --path /repo-without-check-toml
# Output: "✓ All checks passed"
# Expected: Warning about missing check.toml
```

---

### 4. 🟠 Silent Success With Malformed repo-metadata.yaml

**GitHub Issue:** https://github.com/chrismlittle123/drift-toolkit/issues/95

```yaml
# Invalid YAML passes silently:
tier: [invalid
status: broken
```

---

### 5. 🟠 EACCES Error Not Handled Gracefully

**GitHub Issue:** https://github.com/chrismlittle123/drift-toolkit/issues/96

```
Error: EACCES: permission denied, open '.../CODEOWNERS'
```

---

### 6. 🟠 CLI Ignores Scan Timeout Configuration

**GitHub Issue:** https://github.com/chrismlittle123/drift-toolkit/issues/98

```yaml
scans:
  - name: slow-scan
    command: sleep 5 && echo done
    timeout: 500  # Ignored - runs for full 5 seconds
```

---

### 7. 🟠 Process Scan JSON Output Polluted With Issue Creation Message

**GitHub Issue:** https://github.com/chrismlittle123/drift-toolkit/issues/137

```bash
$ drift process scan --repo myorg/myrepo --config check.toml --json
{
  "repository": "myorg/myrepo",
  "violations": [...]
}

[32m✓ Created issue #9[0m
  https://github.com/myorg/myrepo/issues/9
# JSON is unparseable due to extra text
```

---

### 8. 🟠 Misleading "Unknown Command" Error When check.toml Missing

**GitHub Issue:** https://github.com/chrismlittle123/drift-toolkit/issues/138

```bash
$ cd /directory/without/check.toml
$ drift process scan --repo myorg/myrepo
error: unknown command 'process'
# Should say "No check.toml found"
```

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 1 |
| 🟠 High | 7 |
| **Total** | **8** |

---

*Last updated: 2026-01-21*
*Tested version: drift-toolkit@3.4.3*
