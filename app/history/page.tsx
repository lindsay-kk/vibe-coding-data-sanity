'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { FileText, Calendar, ExternalLink, Crown, AlertCircle, Trash2, Award, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { DataSanityNav } from '@/components/data-sanity-nav'

interface Report {
  id: string
  name: string
  type: 'csv' | 'excel' | 'google_sheet'
  originalFilename?: string
  status: 'processing' | 'complete' | 'failed'
  createdAt: string
  completedAt: string | null
  isAccessible: boolean
}

interface Subscription {
  plan_type: 'free' | 'premium'
  reports_limit: number
  reports_used: number
  can_create_report: boolean
}

export default function HistoryPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      setUser(user)
      await Promise.all([fetchReports(), fetchSubscription()])
      setLoading(false)
    }

    checkUser()
  }, [router, supabase.auth])

  const fetchReports = async () => {
    try {
      const response = await fetch('/api/user/reports')
      if (response.ok) {
        const data = await response.json()
        setReports(data.reports)
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error)
    }
  }

  const fetchSubscription = async () => {
    try {
      const response = await fetch('/api/user/subscription')
      if (response.ok) {
        const data = await response.json()
        setSubscription(data)
      }
    } catch (error) {
      console.error('Failed to fetch subscription:', error)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'google_sheet':
        return '📊'
      case 'excel':
        return '📈'
      default:
        return '📄'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'complete':
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Complete</Badge>
      case 'processing':
        return <Badge variant="secondary">Processing</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getFileTypeBadge = (type: string) => {
    switch (type) {
      case 'google_sheet':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800">Google Sheets</Badge>
      case 'excel':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800">Excel</Badge>
      case 'csv':
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800">CSV</Badge>
      default:
        return <Badge variant="outline">{type.toUpperCase()}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedReports(new Set(reports.map(r => r.id)))
    } else {
      setSelectedReports(new Set())
    }
  }

  const handleSelectReport = (reportId: string, checked: boolean) => {
    const newSelected = new Set(selectedReports)
    if (checked) {
      newSelected.add(reportId)
    } else {
      newSelected.delete(reportId)
    }
    setSelectedReports(newSelected)
  }

  const handleDeleteReports = async (reportIds: string[]) => {
    if (reportIds.length === 0) return

    const confirmMessage = reportIds.length === 1
      ? 'Are you sure you want to delete this report?'
      : `Are you sure you want to delete ${reportIds.length} reports?`

    if (!confirm(confirmMessage)) return

    setDeleting(true)
    try {
      const response = await fetch('/api/user/reports/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reportIds }),
      })

      if (response.ok) {
        // Remove deleted reports from state
        setReports(reports.filter(r => !reportIds.includes(r.id)))
        setSelectedReports(new Set())
        // Refresh subscription data to update counts
        await fetchSubscription()
      } else {
        const error = await response.json()
        alert(`Failed to delete reports: ${error.error}`)
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete reports. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteSelected = () => {
    handleDeleteReports(Array.from(selectedReports))
  }

  const handleDeleteSingle = (reportId: string) => {
    handleDeleteReports([reportId])
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your reports...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="flex size-8 items-center justify-center rounded-md bg-black">
                <CheckCircle className="size-5 text-white" />
              </div>
              <h1 className="text-xl font-semibold">Reports History</h1>
              <span className="text-xl font-light text-muted-foreground">/</span>
              <DataSanityNav user={user} onSignOut={() => { setUser(null); router.push('/') }} />
            </div>
            <div className="flex items-center space-x-4">
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Subscription Status */}
        {subscription && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                {subscription.plan_type === 'premium' ? (
                  <>
                    <Crown className="h-5 w-5 text-yellow-500" />
                    <span>Premium Plan</span>
                  </>
                ) : (
                  <>
                    <Award className="h-5 w-5 text-blue-500" />
                    <span>Free Plan</span>
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Reports Used: <span className="font-medium">{subscription.reports_used}</span>
                    {subscription.plan_type === 'free' && (
                      <> / {subscription.reports_limit}</>
                    )}
                  </p>
                  {subscription.plan_type === 'free' && !subscription.can_create_report && (
                    <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm">You've reached your report limit</span>
                    </div>
                  )}
                </div>
                {subscription.plan_type === 'free' && (
                  <Button size="sm" className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                    Upgrade to Premium
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reports List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Your Reports ({reports.length})</span>
              <div className="flex items-center space-x-2">
                {selectedReports.size > 0 && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleDeleteSelected}
                    disabled={deleting}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete Selected ({selectedReports.size})
                  </Button>
                )}
                <Link href="/">
                  <Button size="sm">
                    Create New Report
                  </Button>
                </Link>
              </div>
            </CardTitle>
            {reports.length > 0 && (
              <div className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedReports.size === reports.length && reports.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label className="text-muted-foreground">
                  Select all reports
                </label>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No reports yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first data quality report to get started
                </p>
                <Link href="/">
                  <Button>Create Your First Report</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Show storage limit warning */}
                {subscription?.plan_type === 'free' &&
                 subscription?.reports_limit &&
                 reports.length > subscription.reports_limit && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">Storage Limit Reached</h4>
                    </div>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      Reports beyond your {subscription.reports_limit}-report limit are greyed out.
                      Delete old reports or upgrade to premium for unlimited storage.
                    </p>
                  </div>
                )}
                {reports.map((report, index) => {
                  // Determine if this report is beyond the storage limit
                  const isOverLimit = subscription?.plan_type === 'free' &&
                                     subscription?.reports_limit &&
                                     index >= subscription.reports_limit

                  return (
                  <div
                    key={report.id}
                    className={`relative flex items-center justify-between p-4 border border-border rounded-lg transition-colors ${
                      isOverLimit
                        ? 'opacity-40 bg-muted/20 hover:bg-muted/30'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <input
                        type="checkbox"
                        checked={selectedReports.has(report.id)}
                        onChange={(e) => handleSelectReport(report.id, e.target.checked)}
                        className="rounded border-gray-300"
                        disabled={deleting}
                      />
                      <div className="text-2xl">
                        {getTypeIcon(report.type)}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-foreground">{report.name}</h4>
                          {getFileTypeBadge(report.type)}
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(report.createdAt)}</span>
                          {report.completedAt && (
                            <>
                              <span>•</span>
                              <span>Completed {formatDate(report.completedAt)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {getStatusBadge(report.status)}
                      {report.isAccessible && (
                        <Link href={`/report/${report.id}`}>
                          <Button size="sm" variant="outline">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View Report
                          </Button>
                        </Link>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteSingle(report.id)}
                        disabled={deleting}
                        className="text-destructive hover:text-destructive-foreground hover:bg-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    {isOverLimit && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
                        <div className="text-center p-2">
                          <p className="text-sm font-medium text-muted-foreground">Storage Limit Reached</p>
                          <p className="text-xs text-muted-foreground">Delete old reports or upgrade to premium</p>
                        </div>
                      </div>
                    )}
                  </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fixed Theme Switcher */}
      <div className="fixed bottom-6 right-6 z-50">
        <ThemeSwitcher />
      </div>
    </div>
  )
}