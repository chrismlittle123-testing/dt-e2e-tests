import { execSync, spawn, ChildProcess } from "child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const TEST_ORG = "chrismlittle123-testing";
const CONFIG_REPO = "drift-config";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface TestRepo {
  name: string;
  path: string;
  cleanup: () => void;
}

/**
 * Execute a command and return the result
 */
export function exec(command: string, options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): ExecResult {
  try {
    const stdout = execSync(command, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      encoding: "utf-8",
      maxBuffer: 50 * 1024 * 1024, // 50MB
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: execError.stdout || "",
      stderr: execError.stderr || "",
      exitCode: execError.status || 1,
    };
  }
}

/**
 * Get GitHub token from gh CLI
 */
export function getGitHubToken(): string {
  try {
    return execSync("gh auth token", { encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

/**
 * Run drift CLI command
 */
export function drift(args: string, options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): ExecResult {
  return exec(`npx drift-toolkit ${args}`, options);
}

/**
 * Run drift CLI command with GitHub token automatically included
 */
export function driftWithToken(args: string, options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): ExecResult {
  const token = getGitHubToken();
  return exec(`npx drift-toolkit ${args}`, {
    ...options,
    env: { ...options.env, GITHUB_TOKEN: token },
  });
}

/**
 * Run drift CLI and expect success
 */
export function driftExpectSuccess(args: string, options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): ExecResult {
  const result = drift(args, options);
  if (result.exitCode !== 0) {
    throw new Error(`drift ${args} failed with exit code ${result.exitCode}:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
  }
  return result;
}

/**
 * Run drift CLI and expect failure
 */
export function driftExpectFailure(args: string, options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): ExecResult {
  const result = drift(args, options);
  if (result.exitCode === 0) {
    throw new Error(`drift ${args} should have failed but succeeded:\nstdout: ${result.stdout}`);
  }
  return result;
}

/**
 * Create a temporary directory for testing
 */
export function createTempDir(prefix = "drift-e2e-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

/**
 * Create a mock repository with files
 */
export function createMockRepo(files: Record<string, string>): TestRepo {
  const tempDir = createTempDir();

  // Initialize git repo
  execSync("git init", { cwd: tempDir, stdio: "pipe" });
  execSync("git config user.email 'test@test.com'", { cwd: tempDir, stdio: "pipe" });
  execSync("git config user.name 'Test User'", { cwd: tempDir, stdio: "pipe" });

  // Create files
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = join(tempDir, filePath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
    if (dir && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(fullPath, content);
  }

  // Commit files
  execSync("git add -A", { cwd: tempDir, stdio: "pipe" });
  execSync('git commit -m "Initial commit"', { cwd: tempDir, stdio: "pipe" });

  return {
    name: tempDir.split("/").pop() || "temp",
    path: tempDir,
    cleanup: () => {
      rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

/**
 * Create a test repository on GitHub
 */
export function createGitHubRepo(name: string, options: { private?: boolean } = {}): void {
  const visibility = options.private ? "--private" : "--public";
  exec(`gh repo create ${TEST_ORG}/${name} ${visibility} --confirm 2>/dev/null || true`);
}

/**
 * Delete a test repository on GitHub
 */
export function deleteGitHubRepo(name: string): void {
  exec(`gh repo delete ${TEST_ORG}/${name} --yes 2>/dev/null || true`);
}

/**
 * Clone a repository
 */
export function cloneRepo(repo: string, dest: string): void {
  exec(`git clone https://github.com/${repo}.git ${dest}`);
}

/**
 * Push files to a GitHub repo
 */
export function pushFilesToRepo(repoName: string, files: Record<string, string>): string {
  const tempDir = createTempDir();

  // Clone or init
  const cloneResult = exec(`gh repo clone ${TEST_ORG}/${repoName} ${tempDir} 2>/dev/null`);
  if (cloneResult.exitCode !== 0) {
    // Create new repo
    exec(`gh repo create ${TEST_ORG}/${repoName} --public --confirm`);
    execSync("git init", { cwd: tempDir, stdio: "pipe" });
    execSync(`git remote add origin https://github.com/${TEST_ORG}/${repoName}.git`, { cwd: tempDir, stdio: "pipe" });
  }

  execSync("git config user.email 'test@test.com'", { cwd: tempDir, stdio: "pipe" });
  execSync("git config user.name 'E2E Test'", { cwd: tempDir, stdio: "pipe" });

  // Create/update files
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = join(tempDir, filePath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
    if (dir && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(fullPath, content);
  }

  // Commit and push
  execSync("git add -A", { cwd: tempDir, stdio: "pipe" });
  try {
    execSync('git commit -m "E2E test update"', { cwd: tempDir, stdio: "pipe" });
  } catch {
    // No changes to commit
  }
  execSync("git push -u origin main --force 2>/dev/null || git push -u origin master --force", { cwd: tempDir, stdio: "pipe" });

  return tempDir;
}

/**
 * Read file from a path
 */
export function readFile(path: string): string {
  return readFileSync(path, "utf-8");
}

/**
 * Write file to a path
 */
export function writeFile(path: string, content: string): void {
  const dir = path.substring(0, path.lastIndexOf("/"));
  if (dir && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, content);
}

/**
 * Get test organization name
 */
export function getTestOrg(): string {
  return TEST_ORG;
}

/**
 * Get config repo name
 */
export function getConfigRepo(): string {
  return CONFIG_REPO;
}

/**
 * Wait for a condition
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 30000,
  interval = 1000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Parse JSON output from drift CLI
 */
export function parseJsonOutput<T>(result: ExecResult): T {
  try {
    return JSON.parse(result.stdout) as T;
  } catch {
    throw new Error(`Failed to parse JSON output:\n${result.stdout}\nstderr: ${result.stderr}`);
  }
}
