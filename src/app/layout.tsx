import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CodeSentinel - Security Review for Your Code',
  description: 'Automated security scanning for startup-stack applications',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
