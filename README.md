# drift-toolkit E2E Tests

Comprehensive end-to-end tests for [drift-toolkit](https://github.com/chrismlittle123/drift-toolkit).

## Overview

This repository contains E2E tests that verify all features of drift-toolkit work correctly in real-world scenarios. Tests cover:

- CLI commands (`drift code scan`, `drift code fix`)
- Library API functions
- Organization scanning features
- Edge cases and error handling
- Constants and configuration

## Prerequisites

- Node.js >= 20
- npm or pnpm
- GitHub CLI (`gh`) installed and authenticated
- Access to `chrismlittle123-testing` organization

## Setup

```bash
npm install
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Categories

### CLI Tests (`tests/cli-scan.test.ts`, `tests/cli-fix.test.ts`)
- Local path scanning
- Organization scanning
- Integrity checks
- Discovery features
- Custom scans
- JSON output

### Library API Tests (`tests/library-api.test.ts`)
- Repository detection functions
- Change tracking
- Integrity checking
- Configuration loading
- Project detection

### Organization Scanning Tests (`tests/org-scanning.test.ts`)
- Smart scanning (recent commits only)
- Pre-clone filtering
- Single repo scanning
- Exclusion patterns
- GitHub Actions integration

### Edge Cases (`tests/edge-cases.test.ts`)
- Invalid YAML/TOML handling
- File permission issues
- Large files
- Special characters
- Symlinks
- Concurrent scans

### Constants Tests (`tests/constants.test.ts`)
- Verify all exported constants
- Type validation

## Test Organization

Tests use a testing organization `chrismlittle123-testing` with:
- `drift-config` - Configuration repository

## Contributing

1. Add new test files in `tests/` directory
2. Use utilities from `src/utils.ts` for common operations
3. Run tests before committing
4. Document any bugs found in `issues.md`

## Bugs Found

See [issues.md](./issues.md) for a list of bugs discovered during testing.
