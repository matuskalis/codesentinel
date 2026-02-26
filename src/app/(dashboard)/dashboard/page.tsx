'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DashboardStats, Severity } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Shield, GitPullRequest, AlertTriangle, BarChart3 } from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/dashboard/stats')
        if (res.status === 401) {
          router.push('/')
          return
        }
        const json = await res.json()
        setStats(json.data)
      } catch {
        // Silently handle fetch errors
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [router])

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!stats) return null

  const statCards = [
    {
      label: 'Repositories',
      value: stats.totalRepos,
      icon: Shield,
      color: 'text-primary',
    },
    {
      label: 'Total Scans',
      value: stats.totalScans,
      icon: GitPullRequest,
      color: 'text-green-500',
    },
    {
      label: 'Findings',
      value: stats.totalFindings,
      icon: AlertTriangle,
      color: 'text-severity-high',
    },
    {
      label: 'Avg Risk Score',
      value: stats.avgRiskScore,
      icon: BarChart3,
      color: 'text-severity-medium',
    },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Findings by Severity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            {(['critical', 'high', 'medium', 'low'] as Severity[]).map(
              (sev) => (
                <div key={sev} className="text-center">
                  <p className="text-2xl font-bold">
                    {stats.findingsBySeverity[sev]}
                  </p>
                  <p className="text-sm capitalize text-muted-foreground">
                    {sev}
                  </p>
                </div>
              )
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
