'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ScanStatusBadge } from '@/components/scans/scan-status-badge'
import { SeverityBadge } from '@/components/findings/severity-badge'
import { CodeSnippet } from '@/components/findings/code-snippet'
import type { ScanStatus, Severity, Confidence } from '@/types'

interface Finding {
  id: string
  ruleId: string
  severity: Severity
  confidence: Confidence
  title: string
  description: string
  explanation: string
  fixSuggestion: string
  filePath: string
  startLine: number
  endLine: number
  snippet: string
  status: string
}

interface ScanDetail {
  id: string
  type: string
  commitSha: string
  status: ScanStatus
  riskScore: number | null
  riskLevel: string | null
  errorMessage: string | null
  createdAt: string
  completedAt: string | null
  findings: Finding[]
}

export default function ScanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [scan, setScan] = useState<ScanDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchScan() {
      try {
        const res = await fetch(`/api/scans/${id}`)
        if (res.status === 401) {
          router.push('/')
          return
        }
        if (res.status === 404) {
          router.push('/scans')
          return
        }
        const json = await res.json()
        setScan(json.data)
      } catch {
        // Silently handle fetch errors
      } finally {
        setLoading(false)
      }
    }
    fetchScan()
  }, [id, router])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!scan) return null

  const grouped = {
    critical: [] as Finding[],
    high: [] as Finding[],
    medium: [] as Finding[],
    low: [] as Finding[],
  }
  for (const f of scan.findings) {
    grouped[f.severity].push(f)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Scan Detail</h1>
        <ScanStatusBadge status={scan.status} />
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Type</p>
              <p className="font-medium capitalize">{scan.type}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Commit</p>
              <p className="font-mono text-sm">{scan.commitSha.slice(0, 7)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Risk Score</p>
              <p className="text-lg font-bold">
                {scan.riskScore ?? '-'}/100
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date</p>
              <p className="text-sm">
                {new Date(scan.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
          {scan.errorMessage && (
            <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {scan.errorMessage}
            </div>
          )}
        </CardContent>
      </Card>

      {scan.findings.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-lg font-medium text-green-500">
              No security issues found!
            </p>
          </CardContent>
        </Card>
      ) : (
        (['critical', 'high', 'medium', 'low'] as Severity[]).map(
          (severity) => {
            const items = grouped[severity]
            if (items.length === 0) return null
            return (
              <div key={severity} className="space-y-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <SeverityBadge severity={severity} />
                  <span>
                    {items.length} {severity} finding
                    {items.length > 1 ? 's' : ''}
                  </span>
                </h2>
                {items.map((finding) => (
                  <Card key={finding.id}>
                    <CardContent className="space-y-4 p-6">
                      <div>
                        <h3 className="font-semibold">{finding.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {finding.description}
                        </p>
                      </div>
                      <CodeSnippet
                        code={finding.snippet}
                        startLine={finding.startLine}
                        filePath={finding.filePath}
                      />
                      <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                        <p className="mb-1 text-sm font-medium text-primary">
                          Fix Suggestion
                        </p>
                        <p className="text-sm">{finding.fixSuggestion}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          }
        )
      )}
    </div>
  )
}
