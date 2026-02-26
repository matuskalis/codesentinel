import Link from 'next/link'
import { Shield, GitPullRequest, AlertTriangle, Zap } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col items-center justify-center px-4 pb-16 pt-24 text-center">
        <div className="mb-6 flex items-center gap-3">
          <Shield className="h-12 w-12 text-primary" />
          <h1 className="text-5xl font-bold">CodeSentinel</h1>
        </div>
        <p className="mb-8 max-w-2xl text-xl text-muted-foreground">
          Automated security scanning for your GitHub repositories. Catch
          secrets, injection vulnerabilities, and misconfigurations before they
          ship.
        </p>
        <Link
          href="/api/auth/github"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-8 py-3 text-lg font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <GitPullRequest className="h-5 w-5" />
          Install on GitHub
        </Link>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-6">
            <AlertTriangle className="mb-4 h-8 w-8 text-severity-high" />
            <h3 className="mb-2 text-lg font-semibold">12 Security Rules</h3>
            <p className="text-sm text-muted-foreground">
              Detects hardcoded secrets, SQL injection, XSS, insecure cookies,
              exposed service keys, and more.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-6">
            <GitPullRequest className="mb-4 h-8 w-8 text-primary" />
            <h3 className="mb-2 text-lg font-semibold">PR Reviews</h3>
            <p className="text-sm text-muted-foreground">
              Automatically scans every pull request and posts inline comments
              with fix suggestions.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-6">
            <Zap className="mb-4 h-8 w-8 text-severity-medium" />
            <h3 className="mb-2 text-lg font-semibold">
              Fast & Deterministic
            </h3>
            <p className="text-sm text-muted-foreground">
              No AI hallucinations. Pure pattern matching for reliable,
              reproducible security scanning.
            </p>
          </div>
        </div>
      </div>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <p>CodeSentinel - Security Review for Your Code</p>
      </footer>
    </div>
  )
}
