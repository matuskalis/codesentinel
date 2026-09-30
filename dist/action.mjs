// src/cli/action.ts
import * as path2 from "node:path";
import * as fs2 from "node:fs";

// src/cli/walker.ts
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

// src/lib/scan-limits.ts
var DEFAULT_SCAN_LIMITS = {
  maxFilesPerScan: 500,
  maxBytesPerFile: 512 * 1024,
  // 512KB
  scanTimeoutMs: 12e4,
  // 2 minutes
  ruleTimeoutMs: 5e3,
  // 5 seconds per rule
  skipPatterns: [
    "node_modules",
    ".next",
    "dist",
    "build",
    "coverage",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "*.min.js",
    "*.min.css",
    "*.map",
    "*.woff",
    "*.woff2",
    "*.ttf",
    "*.eot",
    "*.png",
    "*.jpg",
    "*.jpeg",
    "*.gif",
    "*.svg",
    "*.ico",
    "*.mp4",
    "*.webm",
    "*.pdf",
    "*.zip",
    "*.tar",
    "*.gz"
  ]
};
var DIRECTORY_SCAN_LIMITS = {
  ...DEFAULT_SCAN_LIMITS,
  maxFilesPerScan: Number.POSITIVE_INFINITY
};
function shouldSkipFile(filePath, limits = DEFAULT_SCAN_LIMITS) {
  const segments = filePath.split(/[\\/]/);
  const fileName = segments[segments.length - 1];
  return limits.skipPatterns.some((pattern) => {
    if (pattern.startsWith("*.")) {
      return fileName.endsWith(pattern.slice(1));
    }
    return segments.includes(pattern);
  });
}

// src/cli/walker.ts
var MAX_FILE_BYTES = 512 * 1024;
var GIT_OUTPUT_LIMIT_BYTES = 64 * 1024 * 1024;
var SCAN_EXTENSIONS = /* @__PURE__ */ new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".yml", ".yaml"]);
var SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", ".next", "dist", "build", ".git", "coverage", ".turbo", ".vercel"]);
function isEnvFile(name) {
  return name === ".env" || name.startsWith(".env.");
}
function walkDirectory(dir) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      results.push(...walkDirectory(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (SCAN_EXTENSIONS.has(ext) || isEnvFile(entry.name)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}
function toGitPath(relativePath) {
  return relativePath.split(path.sep).join("/");
}
function findGitIgnored(dir, relativePaths) {
  if (relativePaths.length === 0) return /* @__PURE__ */ new Set();
  const result = spawnSync("git", ["-c", "core.fsmonitor=false", "check-ignore", "-z", "--stdin"], {
    cwd: dir,
    input: relativePaths.map(toGitPath).join("\0"),
    encoding: "utf-8",
    maxBuffer: GIT_OUTPUT_LIMIT_BYTES
  });
  if (result.error || result.status !== 0) return /* @__PURE__ */ new Set();
  return new Set(result.stdout.split("\0").filter(Boolean));
}
function buildFileChanges(dir) {
  const absoluteDir = path.resolve(dir);
  const candidates = walkDirectory(absoluteDir).map((absPath) => ({ absPath, relativePath: path.relative(absoluteDir, absPath) })).filter(({ relativePath }) => !shouldSkipFile(relativePath, DEFAULT_SCAN_LIMITS));
  const gitIgnored = findGitIgnored(absoluteDir, candidates.map((candidate) => candidate.relativePath));
  const files = [];
  for (const { absPath, relativePath } of candidates) {
    try {
      const stat = fs.statSync(absPath);
      if (stat.size > MAX_FILE_BYTES) continue;
      const content = fs.readFileSync(absPath, "utf-8");
      const lineCount = content.split("\n").length;
      files.push({
        filePath: relativePath,
        status: "added",
        content,
        additions: [{ start: 1, end: lineCount }],
        deletions: [],
        gitIgnored: gitIgnored.has(toGitPath(relativePath))
      });
    } catch {
    }
  }
  return files;
}

// src/lib/scanner/file-classifier.ts
function classifyFile(filePath, content) {
  const matchPath = filePath.startsWith("/") ? filePath : "/" + filePath;
  return {
    filePath,
    language: detectLanguage(filePath),
    framework: detectFramework(matchPath, content),
    context: detectContext(matchPath, content),
    routeType: detectRouteType(matchPath),
    isTest: detectIsTest(filePath)
  };
}
function detectLanguage(filePath) {
  if (/\.(ts|tsx)$/.test(filePath)) return "typescript";
  if (/\.(js|jsx|mjs|cjs)$/.test(filePath)) return "javascript";
  if (/\.json$/.test(filePath)) return "json";
  if (/\.(ya?ml)$/.test(filePath)) return "yaml";
  if (/\.env/.test(filePath)) return "env";
  return "other";
}
function detectFramework(filePath, content) {
  if (filePath.includes("/app/") || filePath.includes("/pages/")) return "nextjs";
  if (filePath.endsWith("/next.config.ts") || filePath.endsWith("/next.config.js") || filePath.endsWith("/next.config.mjs")) return "nextjs";
  if (content.includes("from 'next") || content.includes('from "next')) return "nextjs";
  if (content.includes("'use client'") || content.includes('"use client"')) return "nextjs";
  if (content.includes("'use server'") || content.includes('"use server"')) return "nextjs";
  if (content.includes("from 'react") || content.includes('from "react')) return "react";
  if (/\.(tsx|jsx)$/.test(filePath)) return "react";
  if (filePath.includes("/api/") || filePath.includes("/server/")) return "node";
  if (content.includes("require(") || content.includes("from 'express") || content.includes("from 'fastify")) return "node";
  return "unknown";
}
function detectContext(filePath, content) {
  if (/\.(config|rc)\.(ts|js|mjs|cjs|json)$/.test(filePath)) return "config";
  if (filePath.endsWith(".env") || filePath.includes(".env.")) return "config";
  if (content.includes("'use client'") || content.includes('"use client"')) return "client";
  if (content.includes("'use server'") || content.includes('"use server"')) return "server";
  if (filePath.includes("/api/") || filePath.includes("/server/") || filePath.includes("middleware")) return "server";
  if (filePath.match(/\/app\/.*\/route\.(ts|js)$/)) return "server";
  if (filePath.includes("/components/") || filePath.includes("/hooks/")) return "client";
  if (filePath.match(/\/app\/.*\/(layout|page|loading|error|not-found)\.(tsx|jsx)$/)) return "server";
  if (filePath.includes("/lib/") || filePath.includes("/utils/") || filePath.includes("/shared/")) return "shared";
  return "unknown";
}
function detectRouteType(filePath) {
  if (filePath.match(/\/app\/.*\/route\.(ts|js)$/) || filePath.match(/\/pages\/api\//)) return "api-route";
  if (filePath.match(/\/app\/.*\/page\.(tsx|jsx|ts|js)$/) || filePath.match(/\/pages\/(?!api\/)/)) return "page";
  if (filePath.includes("/components/")) return "component";
  if (filePath.includes("middleware.") || filePath.match(/\/middleware\//)) return "middleware";
  if (filePath.includes("/lib/") || filePath.includes("/utils/") || filePath.includes("/helpers/")) return "library";
  if (/\.(config|rc)\.(ts|js|mjs|cjs|json)$/.test(filePath)) return "config";
  return "none";
}
function detectIsTest(filePath) {
  return /\.(test|spec|e2e)\.(ts|tsx|js|jsx)$/.test(filePath) || filePath.includes("__tests__") || filePath.includes("__mocks__") || filePath.startsWith("tests/") || filePath.startsWith("test/");
}

// src/lib/rules/fingerprint.ts
import { createHash } from "crypto";
function createFingerprint(ruleId, filePath, snippet) {
  const normalized = snippet.replace(/\s+/g, " ").trim();
  return createHash("sha256").update(`${ruleId}:${filePath}:${normalized}`).digest("hex");
}

// src/lib/rules/hardcoded-secrets.ts
var SECRET_PATTERNS = [
  { name: "Stripe live secret key", regex: /sk_live_[a-zA-Z0-9]{24,}/ },
  { name: "Stripe test secret key", regex: /sk_test_[a-zA-Z0-9]{24,}/, severityOverride: "medium" },
  { name: "AWS access key", regex: /AKIA[0-9A-Z]{16}/ },
  { name: "GitHub personal access token", regex: /ghp_[a-zA-Z0-9]{36}/ },
  { name: "OpenAI API key", regex: /sk-[a-zA-Z0-9]{32,}/ },
  { name: "SendGrid API key", regex: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/ },
  { name: "Slack bot token", regex: /xoxb-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/ },
  { name: "JWT token", regex: /eyJ[a-zA-Z0-9_-]{20,}\.eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/ }
];
var PLACEHOLDER_PATTERNS = /your_key_here|REPLACE_ME|xxx{3,}|placeholder|changeme|TODO/i;
var EXAMPLE_FILE_PATTERNS = /\.example$|\.sample$|\.template$|\.example\.|\.sample\.|\.template\./i;
var FIXTURE_PATTERNS = /\/__fixtures__\/|\/fixtures\/|\/snapshots\/|\.snap$|\.fixture\./i;
var AUTOGEN_DOCS_PATTERNS = /\/documentation\/.*\.json$|\/swagger\.json$|\/openapi\.json$|\/api-docs\.json$/i;
var KNOWN_EXAMPLE_JWTS = /* @__PURE__ */ new Set([
  // jwt.io canonical example (sub: "1234567890", name: "John Doe")
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ"
]);
function withLeadingSlash(filePath) {
  return filePath.startsWith("/") ? filePath : "/" + filePath;
}
function isExampleOrFixtureFile(filePath) {
  return EXAMPLE_FILE_PATTERNS.test(filePath) || FIXTURE_PATTERNS.test(filePath);
}
function isAutogenDocsFile(filePath) {
  return AUTOGEN_DOCS_PATTERNS.test(filePath);
}
function isKnownExampleJwt(jwtValue) {
  const parts = jwtValue.split(".");
  if (parts.length < 2) return false;
  return KNOWN_EXAMPLE_JWTS.has(parts[0] + "." + parts[1]);
}
function isSupabaseAnonKey(jwtValue) {
  try {
    const payloadPart = jwtValue.split(".")[1];
    if (!payloadPart) return false;
    const decoded = atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(decoded);
    return payload.role === "anon" || payload.role === "supabase-demo";
  } catch {
    return false;
  }
}
function isCommentLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("*") || trimmed.startsWith("/*");
}
function isEnvReference(line) {
  return /process\.env\b/.test(line) || /import\.meta\.env\b/.test(line);
}
var hardcodedSecretsRule = {
  id: "hardcoded-secrets",
  name: "Hardcoded Secrets",
  description: "Detects hardcoded API keys, tokens, and other secrets in source code.",
  severity: "critical",
  confidence: "high",
  category: "secrets",
  tags: ["secrets"],
  version: 1,
  applicableTo: {
    languages: ["typescript", "javascript", "json", "yaml", "env"]
  },
  run(file, classification) {
    const findings = [];
    if (classification.isTest) return findings;
    if (file.gitIgnored) return findings;
    const matchPath = withLeadingSlash(file.filePath);
    if (isExampleOrFixtureFile(matchPath)) return findings;
    if (isAutogenDocsFile(matchPath)) return findings;
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      if (isCommentLine(line)) continue;
      if (isEnvReference(line)) continue;
      if (PLACEHOLDER_PATTERNS.test(line)) continue;
      for (const pattern of SECRET_PATTERNS) {
        const match = pattern.regex.exec(line);
        if (!match) continue;
        const matchedValue = match[0];
        if (PLACEHOLDER_PATTERNS.test(matchedValue)) continue;
        if (pattern.name === "JWT token" && (isSupabaseAnonKey(matchedValue) || isKnownExampleJwt(matchedValue))) continue;
        const snippet = line.trim();
        findings.push({
          ruleId: "hardcoded-secrets",
          ruleVersion: 1,
          severity: pattern.severityOverride ?? "critical",
          confidence: "high",
          title: `Hardcoded ${pattern.name} detected`,
          description: `A ${pattern.name} was found hardcoded in the source code at line ${lineNumber}.`,
          explanation: `Hardcoded secrets in source code can be extracted by anyone with access to the repository. This ${pattern.name} should be stored in environment variables and never committed to version control.`,
          fixSuggestion: "Move this secret to environment variables and access it via `process.env.YOUR_SECRET_NAME`.",
          filePath: file.filePath,
          startLine: lineNumber,
          endLine: lineNumber,
          snippet,
          fingerprint: createFingerprint("hardcoded-secrets", file.filePath, snippet)
        });
      }
    }
    return findings;
  }
};

// src/lib/rules/env-committed.ts
var SAFE_ENV_PATTERNS = [".env.example", ".env.sample", ".env.template"];
var PLACEHOLDER_PREFIX = /^(your[_-]|REPLACE|CHANGEME|TODO|placeholder|example|CHANGE[_-]THIS|UPDATE[_-]THIS|INSERT[_-]|PUT[_-]YOUR|ADD[_-]YOUR|ENTER[_-]YOUR|FILL[_-]IN)/i;
var PLACEHOLDER_SUFFIX = /[_-]x{2,}$/i;
var GENERIC_VALUE = /^(0|123|test|true|false|none|null|undefined|n\/a|na|tbd)$/i;
var TEMPLATE_MARKER = /^<[^>]+>$/;
var LOCALHOST_URL = /^https?:\/\/localhost/i;
var SENSITIVE_VAR_NAME = /SECRET|_KEY|TOKEN|PASSWORD|PRIVATE|CREDENTIAL/i;
var KNOWN_SECRET_PREFIX = /^(sk_(?:live|test)_[a-zA-Z0-9]{10,}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36}|sk-[a-zA-Z0-9]{20,}|SG\.[a-zA-Z0-9_-]{22}\.|xoxb-|re_(?:live|test)_[a-zA-Z0-9]|eyJ[a-zA-Z0-9_-]{20,}\.eyJ)/;
var DB_URL_WITH_CREDS = /^(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^:]+:[^@]+@/;
function isPlaceholderValue(value) {
  const v = value.trim().replace(/^["']|["']$/g, "");
  if (v === "") return true;
  if (PLACEHOLDER_PREFIX.test(v)) return true;
  if (PLACEHOLDER_SUFFIX.test(v)) return true;
  if (GENERIC_VALUE.test(v)) return true;
  if (TEMPLATE_MARKER.test(v)) return true;
  if (LOCALHOST_URL.test(v)) return true;
  return false;
}
function hasRealSecrets(content) {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const varName = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (isPlaceholderValue(value)) continue;
    if (KNOWN_SECRET_PREFIX.test(value) || DB_URL_WITH_CREDS.test(value)) return true;
    if (SENSITIVE_VAR_NAME.test(varName) && !/^https?:\/\//i.test(value)) return true;
  }
  return false;
}
var envCommittedRule = {
  id: "env-committed",
  name: "Environment File Committed",
  description: "Detects .env files with real values being committed to the repository.",
  severity: "critical",
  confidence: "high",
  category: "secrets",
  tags: ["secrets", "config"],
  version: 2,
  applicableTo: {
    filePatterns: ["*.env", "*.env.local", "*.env.production", "*.env.development"]
  },
  run(file) {
    const findings = [];
    const isSafeFile = SAFE_ENV_PATTERNS.some((pattern) => file.filePath.endsWith(pattern));
    if (isSafeFile) return findings;
    if (file.status !== "added" && file.status !== "modified") return findings;
    if (file.gitIgnored) return findings;
    if (!hasRealSecrets(file.content)) return findings;
    const snippet = file.filePath;
    findings.push({
      ruleId: "env-committed",
      ruleVersion: 2,
      severity: "critical",
      confidence: "high",
      title: "Environment file with secrets committed",
      description: `The file \`${file.filePath}\` contains environment variables with real values and is being committed to the repository.`,
      explanation: "Environment files often contain database credentials, API keys, and other secrets. Committing them to version control exposes these secrets to anyone with repository access and preserves them in git history.",
      fixSuggestion: "Add this file to `.gitignore` and use `.env.example` with placeholder values instead.",
      filePath: file.filePath,
      startLine: 1,
      endLine: file.content.replace(/\r?\n$/, "").split("\n").length,
      snippet,
      fingerprint: createFingerprint("env-committed", file.filePath, snippet)
    });
    return findings;
  }
};

// src/lib/rules/next-public-secret.ts
var SECRET_KEYWORD_PATTERN = /^NEXT_PUBLIC_.*(?:SECRET|KEY|TOKEN|PASSWORD|PRIVATE).*=(.+)$/i;
var PLACEHOLDER_PATTERNS2 = /your_key_here|REPLACE_ME|xxx{3,}|placeholder|changeme|TODO|<.*>/i;
var SAFE_PUBLIC_VARS = /SUPABASE_ANON_KEY|PUBLISHABLE_KEY|PUBLIC_KEY|CLOUDINARY_API_KEY/i;
var SAFE_VALUE_PATTERNS = /^(pk_(?:test|live)_|https?:\/\/)/i;
var nextPublicSecretRule = {
  id: "next-public-secret",
  name: "Secret Exposed via NEXT_PUBLIC_ Prefix",
  description: "Detects secrets exposed to the client via NEXT_PUBLIC_ environment variable prefix.",
  severity: "high",
  confidence: "high",
  category: "nextjs",
  tags: ["secrets", "nextjs"],
  version: 1,
  applicableTo: {
    filePatterns: [".env"]
  },
  run(file) {
    const findings = [];
    if (/\.(example|sample|template)$/i.test(file.filePath)) {
      return findings;
    }
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const lineNumber = i + 1;
      if (trimmed === "" || trimmed.startsWith("#")) continue;
      const match = SECRET_KEYWORD_PATTERN.exec(trimmed);
      if (!match) continue;
      const varName = trimmed.split("=")[0];
      if (SAFE_PUBLIC_VARS.test(varName)) continue;
      const value = match[1].trim();
      if (value === "" || value === '""' || value === "''" || PLACEHOLDER_PATTERNS2.test(value)) continue;
      if (SAFE_VALUE_PATTERNS.test(value)) continue;
      const snippet = trimmed;
      findings.push({
        ruleId: "next-public-secret",
        ruleVersion: 1,
        severity: "high",
        confidence: "high",
        title: "Secret exposed via NEXT_PUBLIC_ prefix",
        description: `The environment variable on line ${lineNumber} uses the \`NEXT_PUBLIC_\` prefix, which exposes its value to client-side JavaScript bundles.`,
        explanation: "Variables prefixed with `NEXT_PUBLIC_` are inlined into the client-side JavaScript bundle at build time. Secrets, keys, tokens, and passwords should never use this prefix as they will be visible to anyone inspecting the browser JavaScript.",
        fixSuggestion: "Remove the `NEXT_PUBLIC_` prefix so the secret stays server-side. Use a server action or API route to access this value.",
        filePath: file.filePath,
        startLine: lineNumber,
        endLine: lineNumber,
        snippet,
        fingerprint: createFingerprint("next-public-secret", file.filePath, snippet)
      });
    }
    return findings;
  }
};

// src/lib/rules/supabase-service-key-client.ts
var SERVICE_ROLE_PATTERNS = [
  { regex: /SUPABASE_SERVICE_ROLE_KEY/, label: "SUPABASE_SERVICE_ROLE_KEY reference" },
  { regex: /supabaseServiceRoleKey/, label: "supabaseServiceRoleKey variable" },
  { regex: /service_role/, label: "service_role reference" },
  { regex: /serviceRole/, label: "serviceRole reference" }
];
var supabaseServiceKeyClientRule = {
  id: "supabase-service-key-client",
  name: "Supabase Service Role Key in Client Code",
  description: "Detects usage of the Supabase service role key in client-side code, which exposes full database access.",
  severity: "critical",
  confidence: "high",
  category: "supabase",
  tags: ["supabase", "secrets"],
  version: 1,
  applicableTo: {
    languages: ["typescript", "javascript"],
    contexts: ["client"]
  },
  run(file, classification) {
    const findings = [];
    if (classification.isTest) return findings;
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;
      for (const pattern of SERVICE_ROLE_PATTERNS) {
        if (!pattern.regex.test(line)) continue;
        const snippet = trimmed;
        findings.push({
          ruleId: "supabase-service-key-client",
          ruleVersion: 1,
          severity: "critical",
          confidence: "high",
          title: `Supabase service role key used in client code`,
          description: `A ${pattern.label} was found in client-side code at line ${lineNumber}. The service role key bypasses Row Level Security and grants full database access.`,
          explanation: "The Supabase service role key has full admin access to your database, bypassing all Row Level Security policies. If exposed in client-side code, it is visible to anyone who inspects the JavaScript bundle, allowing them to read, modify, or delete any data.",
          fixSuggestion: "Never use the Supabase service role key in client-side code. Use the anon key for client-side and service role key only in server-side API routes.",
          filePath: file.filePath,
          startLine: lineNumber,
          endLine: lineNumber,
          snippet,
          fingerprint: createFingerprint("supabase-service-key-client", file.filePath, snippet)
        });
        break;
      }
    }
    return findings;
  }
};

// src/lib/rules/stripe-no-webhook-verify.ts
var STRIPE_IMPORT = /(?:import\s+.*from\s+['"]stripe['"]|require\s*\(\s*['"]stripe['"]\s*\)|new\s+Stripe\s*\(|stripe\.)/;
var WEBHOOK_PATH = /\/webhook|stripe[_-]webhook|webhook[_-]handler/i;
var VERIFICATION_PATTERN = /constructEvent|stripe-signature|webhookEndpointSecret|webhook_secret|whsec_/;
var POST_HANDLER = /export\s+(?:async\s+)?function\s+POST|\.post\s*\(|method.*POST|request\.method\s*===?\s*['"]POST['"]/;
var stripeNoWebhookVerifyRule = {
  id: "stripe-no-webhook-verify",
  name: "Stripe Webhook Missing Signature Verification",
  description: "Detects Stripe webhook handlers that do not verify the webhook signature.",
  severity: "high",
  confidence: "medium",
  category: "stripe",
  tags: ["stripe", "webhook"],
  version: 1,
  applicableTo: {
    languages: ["typescript", "javascript"],
    routeTypes: ["api-route"]
  },
  run(file, classification) {
    const findings = [];
    if (classification.isTest) return findings;
    const content = file.content;
    const hasStripe = STRIPE_IMPORT.test(content);
    const isWebhookPath = WEBHOOK_PATH.test(classification.filePath);
    const hasVerification = VERIFICATION_PATTERN.test(content);
    const hasPostHandler = POST_HANDLER.test(content);
    if (hasStripe && isWebhookPath && hasPostHandler && !hasVerification) {
      const lines = content.split("\n");
      let webhookLine = 1;
      for (let i = 0; i < lines.length; i++) {
        if (STRIPE_IMPORT.test(lines[i])) {
          webhookLine = i + 1;
          break;
        }
      }
      const snippet = lines[webhookLine - 1]?.trim() ?? file.filePath;
      findings.push({
        ruleId: "stripe-no-webhook-verify",
        ruleVersion: 1,
        severity: "high",
        confidence: "medium",
        title: "Stripe webhook handler missing signature verification",
        description: `The file \`${file.filePath}\` handles Stripe webhooks but does not verify the webhook signature using \`constructEvent\`.`,
        explanation: "Without signature verification, anyone can send forged webhook events to your endpoint. An attacker could fake payment confirmations, subscription changes, or other critical events, leading to unauthorized access or financial fraud.",
        fixSuggestion: "Add Stripe webhook signature verification using `stripe.webhooks.constructEvent(body, sig, webhookSecret)` to prevent forged webhook events.",
        filePath: file.filePath,
        startLine: webhookLine,
        endLine: webhookLine,
        snippet,
        fingerprint: createFingerprint("stripe-no-webhook-verify", file.filePath, snippet)
      });
    }
    return findings;
  }
};

// src/lib/rules/index.ts
var allRules = [
  hardcodedSecretsRule,
  envCommittedRule,
  nextPublicSecretRule,
  stripeNoWebhookVerifyRule,
  supabaseServiceKeyClientRule
];
function getRulesForFile(classification) {
  return allRules.filter((rule) => {
    const { applicableTo } = rule;
    if (applicableTo.languages && applicableTo.languages.length > 0) {
      if (!applicableTo.languages.includes(classification.language)) return false;
    }
    if (applicableTo.contexts && applicableTo.contexts.length > 0) {
      if (!applicableTo.contexts.includes(classification.context)) return false;
    }
    if (applicableTo.routeTypes && applicableTo.routeTypes.length > 0) {
      if (!applicableTo.routeTypes.includes(classification.routeType)) return false;
    }
    if (applicableTo.filePatterns && applicableTo.filePatterns.length > 0) {
      const matches = applicableTo.filePatterns.some((pattern) => {
        if (pattern.startsWith("*.")) {
          return classification.filePath.endsWith(pattern.slice(1));
        }
        return classification.filePath.includes(pattern);
      });
      if (!matches) return false;
    }
    return true;
  });
}

// src/lib/scanner/deduplicator.ts
var SEVERITY_ORDER = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};
function deduplicateFindings(findings) {
  const byFingerprint = /* @__PURE__ */ new Map();
  for (const finding of findings) {
    const existing = byFingerprint.get(finding.fingerprint);
    if (!existing || SEVERITY_ORDER[finding.severity] > SEVERITY_ORDER[existing.severity]) {
      byFingerprint.set(finding.fingerprint, finding);
    }
  }
  return Array.from(byFingerprint.values());
}

// src/lib/scoring/index.ts
var SEVERITY_WEIGHTS = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3
};
var CONFIDENCE_WEIGHTS = {
  high: 1,
  medium: 0.6,
  low: 0.3
};
function calculateRiskScore(findings) {
  if (findings.length === 0) return 0;
  let rawScore = 0;
  for (const finding of findings) {
    rawScore += SEVERITY_WEIGHTS[finding.severity] * CONFIDENCE_WEIGHTS[finding.confidence];
  }
  return Math.min(100, Math.round(rawScore));
}
function getRiskLevel(score) {
  if (score >= 81) return "critical";
  if (score >= 51) return "high";
  if (score >= 21) return "medium";
  return "low";
}

// src/cli/logger-shim.ts
var noop = () => {
};
var noopLogger = {
  info: noop,
  warn: noop,
  error: noop,
  debug: noop,
  trace: noop,
  fatal: noop,
  child: () => noopLogger,
  level: "silent"
};
var logger = noopLogger;

// src/lib/scanner/index.ts
async function runScan(files, mutedRuleIds = [], limits = DEFAULT_SCAN_LIMITS) {
  const startTime = Date.now();
  const allFindings = [];
  const mutedSet = new Set(mutedRuleIds);
  const rulesApplied = /* @__PURE__ */ new Set();
  let filesScanned = 0;
  const filesToScan = files.filter((f) => f.status !== "deleted").filter((f) => !shouldSkipFile(f.filePath, limits)).filter((f) => Buffer.byteLength(f.content, "utf-8") <= limits.maxBytesPerFile).slice(0, limits.maxFilesPerScan);
  for (const file of filesToScan) {
    if (Date.now() - startTime > limits.scanTimeoutMs) {
      logger.warn({ filesScanned, totalFiles: filesToScan.length }, "Scan timeout reached");
      break;
    }
    const classification = classifyFile(file.filePath, file.content);
    const applicableRules = getRulesForFile(classification).filter((rule) => !mutedSet.has(rule.id));
    for (const rule of applicableRules) {
      rulesApplied.add(rule.id);
      try {
        const ruleStart = Date.now();
        const findings = rule.run(file, classification);
        const ruleTime = Date.now() - ruleStart;
        if (ruleTime > limits.ruleTimeoutMs) {
          logger.warn({ ruleId: rule.id, ruleTime, filePath: file.filePath }, "Rule execution exceeded timeout");
        }
        allFindings.push(...findings);
      } catch (error) {
        logger.error({ ruleId: rule.id, filePath: file.filePath, error }, "Rule execution failed");
      }
    }
    filesScanned++;
  }
  const dedupedFindings = deduplicateFindings(allFindings);
  const riskScore = calculateRiskScore(dedupedFindings);
  const riskLevel = getRiskLevel(riskScore);
  const scanDuration = Date.now() - startTime;
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of dedupedFindings) {
    bySeverity[f.severity]++;
  }
  return {
    findings: dedupedFindings,
    riskScore,
    riskLevel,
    summary: {
      totalFindings: dedupedFindings.length,
      bySeverity,
      filesScanned,
      rulesApplied: rulesApplied.size,
      scanDurationMs: scanDuration
    }
  };
}

// src/cli/action.ts
process.env.LOG_LEVEL = "silent";
var SEVERITY_ORDER2 = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};
function annotationLevel(severity) {
  if (severity === "critical" || severity === "high") return "error";
  if (severity === "medium") return "warning";
  return "notice";
}
function sanitizeAnnotationMessage(text) {
  return text.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}
function emitAnnotation(finding) {
  const level = annotationLevel(finding.severity);
  const file = finding.filePath;
  const line = finding.startLine;
  const endLine = finding.endLine;
  const title = sanitizeAnnotationMessage(finding.title);
  const message = sanitizeAnnotationMessage(
    `${finding.description}

Fix: ${finding.fixSuggestion}`
  );
  process.stdout.write(
    `::${level} file=${file},line=${line},endLine=${endLine},title=${title}::${message}
`
  );
}
function shouldFail(findings, failOn) {
  const threshold = SEVERITY_ORDER2[failOn];
  if (failOn === "low") {
    return findings.length;
  }
  return findings.filter(
    (f) => SEVERITY_ORDER2[f.severity] >= threshold && f.confidence === "high"
  ).length;
}
async function main() {
  const directory = process.env.INPUT_DIRECTORY || ".";
  const failOn = process.env.INPUT_FAIL_ON || "high";
  if (!["critical", "high", "medium", "low"].includes(failOn)) {
    process.stdout.write(
      `::error::Invalid fail-on value: "${failOn}". Must be one of: critical, high, medium, low
`
    );
    process.exit(2);
  }
  const absoluteDir = path2.resolve(directory);
  if (!fs2.existsSync(absoluteDir)) {
    process.stdout.write(`::error::Directory not found: ${absoluteDir}
`);
    process.exit(2);
  }
  const files = buildFileChanges(absoluteDir);
  const result = await runScan(files, [], DIRECTORY_SCAN_LIMITS);
  const sorted = [...result.findings].sort(
    (a, b) => SEVERITY_ORDER2[b.severity] - SEVERITY_ORDER2[a.severity]
  );
  for (const finding of sorted) {
    emitAnnotation(finding);
  }
  process.stdout.write("::group::CodeSentinel Scan Summary\n");
  process.stdout.write(`Files scanned: ${result.summary.filesScanned}
`);
  process.stdout.write(`Rules applied: ${result.summary.rulesApplied}
`);
  process.stdout.write(`Scan duration: ${result.summary.scanDurationMs}ms
`);
  process.stdout.write(`Total findings: ${result.summary.totalFindings}
`);
  process.stdout.write(`Risk score: ${result.riskScore}/100 (${result.riskLevel})
`);
  if (result.summary.bySeverity.critical > 0) {
    process.stdout.write(`  Critical: ${result.summary.bySeverity.critical}
`);
  }
  if (result.summary.bySeverity.high > 0) {
    process.stdout.write(`  High: ${result.summary.bySeverity.high}
`);
  }
  if (result.summary.bySeverity.medium > 0) {
    process.stdout.write(`  Medium: ${result.summary.bySeverity.medium}
`);
  }
  if (result.summary.bySeverity.low > 0) {
    process.stdout.write(`  Low: ${result.summary.bySeverity.low}
`);
  }
  process.stdout.write("::endgroup::\n");
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs2.appendFileSync(outputFile, `findings-count=${result.summary.totalFindings}
`);
    fs2.appendFileSync(outputFile, `risk-score=${result.riskScore}
`);
    fs2.appendFileSync(outputFile, `risk-level=${result.riskLevel}
`);
  }
  const blockingCount = shouldFail(result.findings, failOn);
  if (blockingCount > 0) {
    process.stdout.write(
      `
::error::CodeSentinel found ${blockingCount} blocking finding(s) at ${failOn}+ severity. Scan failed.
`
    );
    process.exit(1);
  }
  process.stdout.write("\nCodeSentinel scan passed: no blocking findings.\n");
}
main().catch((err) => {
  process.stdout.write(
    `::error::CodeSentinel crashed: ${err instanceof Error ? err.message : String(err)}
`
  );
  process.exit(2);
});
