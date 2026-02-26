import { NextResponse } from 'next/server'
import { deleteUserSession } from '@/lib/auth/session'
import { getEnv } from '@/lib/env'

export async function POST() {
  await deleteUserSession()
  const env = getEnv()
  return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}`)
}
