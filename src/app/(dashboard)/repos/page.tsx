'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { FolderGit2 } from 'lucide-react'

interface Repo {
  id: string
  fullName: string
  defaultBranch: string
  isActive: boolean
  createdAt: string
}

export default function ReposPage() {
  const router = useRouter()
  const [repos, setRepos] = useState<Repo[]>([])
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Repositories</h1>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : repos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <FolderGit2 className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">No repositories connected</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Install the CodeSentinel GitHub App to start scanning
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {repos.map((repo) => (
            <Card
              key={repo.id}
              className="cursor-pointer transition-colors hover:border-primary/50"
              onClick={() => router.push(`/scans?repoId=${repo.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <FolderGit2 className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">{repo.fullName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Branch: {repo.defaultBranch}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
