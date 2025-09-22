import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const googleClientId = process.env.GOOGLE_CLIENT_ID
    const publicGoogleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

    return NextResponse.json({
      hasGoogleClientId: !!googleClientId,
      hasPublicGoogleClientId: !!publicGoogleClientId,
      hasGoogleClientSecret: !!googleClientSecret,
      googleClientIdLength: googleClientId?.length || 0,
      publicGoogleClientIdMatch: googleClientId === publicGoogleClientId,
      nextAuthUrl: process.env.NEXTAUTH_URL
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to check OAuth config',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}