'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { SeverityBadge } from '@/components/findings/severity-badge'
import type { Severity, FindingStatus } from '@/types'

interface Finding {
  id: string
  scanId: string
  ruleId: string
  severity: Severity
  confidence: string
  title: string
  filePath: string
  startLine: number
  status: FindingStatus
  createdAt: string
}

function FindingsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const repoId = searchParams.get('repoId')
  const [findings, setFindings] = useState<Finding[]>([])
  const [loading, setLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  useEffect(() => {
    async function fetchFindings() {
      if (!repoId) {
        setLoading(false)
        return
      }
      try {
        const params = new URLSearchParams({ repoId })
        if (severityFilter) params.set('severity', severityFilter)
        if (statusFilter) params.set('status', statusFilter)

        const res = await fetch(`/api/findings?${params}`)
        if (res.status === 401) {
          router.push('/')
          return
        }
        const json = await res.json()
        setFindings(json.data)
      } catch {
        // Silently handle fetch errors
      } finally {
        setLoading(false)
      }
    }
    fetchFindings()
  }, [repoId, severityFilter, statusFilter, router])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Findings</h1>

      {!repoId ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              Select a repository to view findings
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex gap-4">
            <Select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="max-w-xs"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="max-w-xs"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="muted">Muted</option>
              <option value="resolved">Resolved</option>
            </Select>
          </div>

          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : findings.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">
                  No findings match your filters
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {findings.map((f) => (
                    <TableRow
                      key={f.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/scans/${f.scanId}`)}
                    >
                      <TableCell>
                        <SeverityBadge severity={f.severity} />
                      </TableCell>
                      <TableCell className="font-medium">{f.title}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {f.filePath}:{f.startLine}
                      </TableCell>
                      <TableCell className="capitalize">{f.status}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(f.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

export default function FindingsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Findings</h1>
          <Skeleton className="h-48 w-full" />
        </div>
      }
    >
      <FindingsContent />
    </Suspense>
  )
}
