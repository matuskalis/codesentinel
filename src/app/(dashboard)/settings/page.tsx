'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Trash2 } from 'lucide-react'

interface MutedRule {
  id: string
  repoId: string
  ruleId: string
  reason: string | null
  createdAt: string
}

interface Repo {
  id: string
  fullName: string
}

export default function SettingsPage() {
  const router = useRouter()
  const [repos, setRepos] = useState<Repo[]>([])
  const [selectedRepo, setSelectedRepo] = useState<string>('')
  const [mutedRules, setMutedRules] = useState<MutedRule[]>([])
  const [loading, setLoading] = useState(true)
  const [newRuleId, setNewRuleId] = useState('')
  const [newReason, setNewReason] = useState('')

  useEffect(() => {
    async function fetchRepos() {
      try {
        const res = await fetch('/api/repos')
        if (res.status === 401) {
          router.push('/')
          return
        }
        const json = await res.json()
        setRepos(json.data)
      } catch {
        // Silently handle fetch errors
      } finally {
        setLoading(false)
      }
    }
    fetchRepos()
  }, [router])

  useEffect(() => {
    if (!selectedRepo) return
    async function fetchMuted() {
      try {
        const res = await fetch(`/api/muted-rules?repoId=${selectedRepo}`)
        const json = await res.json()
        setMutedRules(json.data)
      } catch {
        // Silently handle fetch errors
      }
    }
    fetchMuted()
  }, [selectedRepo])

  async function handleMute() {
    if (!selectedRepo || !newRuleId) return
    try {
      await fetch('/api/muted-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoId: selectedRepo,
          ruleId: newRuleId,
          reason: newReason || undefined,
        }),
      })
      setNewRuleId('')
      setNewReason('')
      const res = await fetch(`/api/muted-rules?repoId=${selectedRepo}`)
      const json = await res.json()
      setMutedRules(json.data)
    } catch {
      // Silently handle fetch errors
    }
  }

  async function handleUnmute(ruleId: string) {
    try {
      await fetch('/api/muted-rules', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoId: selectedRepo, ruleId }),
      })
      setMutedRules(mutedRules.filter((r) => r.ruleId !== ruleId))
    } catch {
      // Silently handle fetch errors
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Muted Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <select
            value={selectedRepo}
            onChange={(e) => setSelectedRepo(e.target.value)}
            className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select repository...</option>
            {repos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.fullName}
              </option>
            ))}
          </select>

          {selectedRepo && (
            <>
              <div className="flex gap-2">
                <Input
                  placeholder="Rule ID (e.g., hardcoded-secrets)"
                  value={newRuleId}
                  onChange={(e) => setNewRuleId(e.target.value)}
                  className="max-w-xs"
                />
                <Input
                  placeholder="Reason (optional)"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="max-w-xs"
                />
                <Button onClick={handleMute} disabled={!newRuleId}>
                  Mute Rule
                </Button>
              </div>

              {mutedRules.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule ID</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Muted Since</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mutedRules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-mono text-sm">
                          {rule.ruleId}
                        </TableCell>
                        <TableCell>{rule.reason ?? '-'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(rule.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleUnmute(rule.ruleId)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
