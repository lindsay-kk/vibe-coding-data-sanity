'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/auth'
import { Upload, FileSpreadsheet, Link2, CheckCircle, AlertCircle, Blend } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataSanityLoginForm } from '@/components/data-sanity-login-form'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { DataSanityNav } from '@/components/data-sanity-nav'
import type { User } from '@supabase/supabase-js'

export default function DataSanityPage() {
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [googleSheetUrl, setGoogleSheetUrl] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()

  // Initialize auth
  const supabase = createClient()

  // Check auth status
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    checkAuth()
  }, [supabase.auth])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleFileUpload = useCallback(async (file: File) => {
    if (!user) {
      alert('Please log in first')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const { reportId } = await response.json()
      router.push(`/report/${reportId}`)
    } catch (error) {
      console.error('Upload error:', error)
      alert('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }, [user, router])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFileUpload(e.dataTransfer.files[0])
    }
  }, [handleFileUpload])

  const handleGoogleSheetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      alert('Please log in first')
      return
    }

    if (!googleSheetUrl.trim()) {
      alert('Please enter a Google Sheet URL')
      return
    }

    // First try without OAuth (for public sheets)
    setUploading(true)
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ googleSheetUrl }),
      })

      console.log('Upload response status:', response.status, 'ok:', response.ok)

      if (response.ok) {
        const { reportId } = await response.json()
        router.push(`/report/${reportId}`)
        return
      }

      // If public access fails, try OAuth
      const errorData = await response.json()
      console.log('Upload error details:', { status: response.status, errorData })
      console.log('Checking OAuth conditions:', {
        requiresOAuth: errorData.requiresOAuth,
        errorType: errorData.error,
        isOAuthError: errorData.error === 'oauth_required',
        status403: response.status === 403
      })

      if (errorData.requiresOAuth || errorData.error === 'oauth_required' || (errorData.error && (errorData.error.includes('permissions') || errorData.error.includes('Access denied'))) || response.status === 403) {
        console.log('Attempting OAuth redirect...')

        // Check if we have the client ID
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
        console.log('Client ID check:', clientId ? 'Found' : 'Missing')
        if (!clientId) {
          alert('Google OAuth is not configured. Please set up NEXT_PUBLIC_GOOGLE_CLIENT_ID in environment variables.')
          setUploading(false)
          return
        }

        // Redirect to Google OAuth
        const oauth2Url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
        oauth2Url.searchParams.append('client_id', clientId)
        oauth2Url.searchParams.append('redirect_uri', `${window.location.origin}/api/auth/google/callback`)
        oauth2Url.searchParams.append('response_type', 'code')
        oauth2Url.searchParams.append('scope', 'https://www.googleapis.com/auth/spreadsheets.readonly')
        oauth2Url.searchParams.append('access_type', 'offline')
        oauth2Url.searchParams.append('state', googleSheetUrl) // Pass sheet URL as state

        console.log('Redirecting to OAuth:', oauth2Url.toString())
        window.location.href = oauth2Url.toString()
        return
      }

      throw new Error(errorData.error || 'Upload failed')
    } catch (error) {
      console.error('Upload error:', error)
      alert('Upload failed. Please try again.')
      setUploading(false)
    }
  }

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}`
      }
    })
    if (error) console.error('Error signing in:', error)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  if (!user) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
        <div className="w-full max-w-sm">
          <DataSanityLoginForm onSignIn={signIn} />
        </div>

        {/* Theme Switcher */}
        <ThemeSwitcher />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="flex size-8 items-center justify-center rounded-md bg-black">
                <CheckCircle className="size-5 text-white" />
              </div>
              <h1 className="text-xl font-semibold">Data Sanity</h1>
              <span className="text-xl font-light text-muted-foreground">/</span>
              <DataSanityNav user={user} onSignOut={() => setUser(null)} />
            </div>
            <div className="flex items-center space-x-4">
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl p-6">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">
            Sanity Check Your Data
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload your CSV/Excel files or link to Google Sheets for AI-powered data validation,
            cleaning recommendations, and annotated outputs.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-blue-100">
                  <Upload className="size-5 text-blue-600" />
                </div>
                Upload File
              </CardTitle>
            </CardHeader>
            <CardContent>

              <div
                className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <FileSpreadsheet className="size-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-foreground mb-4">
                  Drag and drop your CSV or Excel file here, or click to browse
                </p>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploading}
                />
                <p className="text-sm text-muted-foreground">
                  Supports CSV, XLSX, XLS files up to 10MB
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Google Sheets */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-green-100">
                  <Link2 className="size-5 text-green-600" />
                </div>
                Google Sheets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGoogleSheetSubmit} className="space-y-4">
                <div>
                  <label htmlFor="sheet-url" className="block text-sm font-medium text-foreground mb-2">
                    Google Sheet URL
                  </label>
                  <input
                    id="sheet-url"
                    type="url"
                    value={googleSheetUrl}
                    onChange={(e) => setGoogleSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-background text-foreground"
                    disabled={uploading}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Make sure your Google Sheet is publicly viewable (Anyone with the link can view)
                </p>
                <Button
                  type="submit"
                  disabled={uploading || !googleSheetUrl.trim()}
                  className="w-full"
                  variant="default"
                >
                  Analyze Sheet
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Features */}
        <div className="mt-16">
          <h3 className="text-2xl font-bold text-foreground text-center mb-8">
            What We Check
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: AlertCircle,
                title: 'Missing Values',
                description: 'Detect null, empty, and undefined values',
                color: 'text-red-600',
                bg: 'bg-red-100',
              },
              {
                icon: Blend,
                title: 'Duplicates',
                description: 'Find duplicate rows and key field duplicates',
                color: 'text-green-600',
                bg: 'bg-green-100',
              },
              {
                icon: FileSpreadsheet,
                title: 'Format Issues',
                description: 'Inconsistent dates, numbers, and data types',
                color: 'text-yellow-600',
                bg: 'bg-yellow-100',
              },
              {
                icon: Upload,
                title: 'Outliers',
                description: 'Statistical anomalies and unusual values',
                color: 'text-blue-600',
                bg: 'bg-blue-100',
              },
            ].map((feature, index) => (
              <Card key={index} className="text-center">
                <CardContent className="pt-6">
                  <div className={`size-10 ${feature.bg} rounded-lg flex items-center justify-center mx-auto mb-4`}>
                    <feature.icon className={`size-6 ${feature.color}`} />
                  </div>
                  <h4 className="text-lg font-semibold text-foreground mb-2">
                    {feature.title}
                  </h4>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {uploading && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-auto">
              <CardContent className="flex flex-col items-center p-6">
                <div className="animate-spin rounded-full size-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Processing your data...</p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Theme Switcher */}
      <ThemeSwitcher />
    </div>
  )
}