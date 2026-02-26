'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Shield,
  LayoutDashboard,
  GitPullRequest,
  AlertTriangle,
  Settings,
  FolderGit2,
} from 'lucide-react'

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Repositories', href: '/repos', icon: FolderGit2 },
  { label: 'Scans', href: '/scans', icon: GitPullRequest },
  { label: 'Findings', href: '/findings', icon: AlertTriangle },
  { label: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-64 border-r border-border bg-card lg:block">
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <Shield className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">CodeSentinel</span>
      </div>
      <nav className="space-y-1 p-4">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
