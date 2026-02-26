import { NextResponse } from 'next/server'
import { buildAuthUrl, setStateCookie } from '@/lib/auth/github-oauth'

export async function GET() {
  const { url, state } = buildAuthUrl()
  await setStateCookie(state)
  return NextResponse.redirect(url)
}
