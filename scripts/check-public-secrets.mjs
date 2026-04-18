import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const trackedFiles = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split(/\r?\n/u)
  .filter(Boolean)
  .filter((filePath) => !filePath.endsWith("pnpm-lock.yaml"));

const forbiddenPatterns = [
  { label: "Supabase service-role key marker", pattern: /\bservice_role\b/u },
  { label: "Supabase secret key", pattern: /\bsb_secret_[A-Za-z0-9_-]+/u },
  { label: "OpenAI-style API key", pattern: /\bsk-[A-Za-z0-9_-]{20,}/u },
  { label: "GitHub personal access token", pattern: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}/u },
  { label: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/u },
  { label: "private key block", pattern: /-----BEGIN (?:RSA |OPENSSH |EC |DSA |)?PRIVATE KEY-----/u },
  { label: "OAuth client secret assignment", pattern: /\bclient_secret\s*[:=]\s*["'][^"']+["']/iu }
];

const findings = [];

for (const filePath of trackedFiles) {
  let contents;
  try {
    contents = readFileSync(filePath, "utf8");
  } catch {
    continue;
  }

  for (const { label, pattern } of forbiddenPatterns) {
    if (pattern.test(contents)) {
      findings.push(`${filePath}: ${label}`);
    }
  }
}

if (findings.length > 0) {
  console.error("Potential public-secret findings:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log(`No high-confidence public-secret findings in ${trackedFiles.length} tracked files.`);
