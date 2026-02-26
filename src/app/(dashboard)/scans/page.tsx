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
import { Skeleton } from '@/components/ui/skeleton'
import { ScanStatusBadge } from '@/components/scans/scan-status-badge'
import type { ScanStatus } from '@/types'

interface Scan {
  id: string
  repoId: string
  type: string
  commitSha: string
  status: ScanStatus
  riskScore: number | null
  riskLevel: string | null
  createdAt: string
  completedAt: string | null
}

function ScansContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const repoId = searchParams.get('repoId')
  const [scans, setScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchScans() {
      if (!repoId) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch(`/api/scans?repoId=${repoId}`)
        if (res.status === 401) {
          router.push('/')
          return
        }
        const json = await res.json()
        setScans(json.data)
      } catch {
        // Silently handle fetch errors
      } finally {
        setLoading(false)
      }
    }
    fetchScans()
  }, [repoId, router])

  if (!repoId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Scans</h1>
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              Select a repository to view its scans
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Scans</h1>

      {loading ? (
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      ) : scans.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              No scans yet for this repository
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Commit</TableHead>
                <TableHead>Risk Score</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scans.map((scan) => (
                <TableRow
                  key={scan.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/scans/${scan.id}`)}
                >
                  <TableCell>
                    <ScanStatusBadge status={scan.status} />
                  </TableCell>
                  <TableCell className="capitalize">{scan.type}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {scan.commitSha.slice(0, 7)}
                  </TableCell>
                  <TableCell>
                    {scan.riskScore !== null ? (
                      <span className="font-semibold">{scan.riskScore}/100</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(scan.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

export default function ScansPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Scans</h1>
          <Skeleton className="h-48 w-full" />
        </div>
      }
    >
      <ScansContent />
    </Suspense>
  )
}
