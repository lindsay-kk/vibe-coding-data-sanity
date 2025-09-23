import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          },
        },
      }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { reportIds } = await request.json()

    if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
      return NextResponse.json({ error: 'No report IDs provided' }, { status: 400 })
    }

    // Verify all reports belong to the user
    const { data: reports, error: verifyError } = await supabaseAdmin
      .from('reports')
      .select('id, file_id')
      .eq('user_id', user.id)
      .in('id', reportIds)

    if (verifyError) {
      console.error('Failed to verify reports:', verifyError)
      return NextResponse.json({ error: 'Failed to verify reports' }, { status: 500 })
    }

    if (reports.length !== reportIds.length) {
      return NextResponse.json({ error: 'Some reports not found or unauthorized' }, { status: 403 })
    }

    // Get file IDs for cleanup
    const fileIds = reports.map(report => report.file_id).filter(Boolean)

    // Delete reports
    const { error: deleteReportsError } = await supabaseAdmin
      .from('reports')
      .delete()
      .in('id', reportIds)

    if (deleteReportsError) {
      console.error('Failed to delete reports:', deleteReportsError)
      return NextResponse.json({ error: 'Failed to delete reports' }, { status: 500 })
    }

    // Delete associated files
    if (fileIds.length > 0) {
      const { error: deleteFilesError } = await supabaseAdmin
        .from('files')
        .delete()
        .in('id', fileIds)

      if (deleteFilesError) {
        console.error('Failed to delete files:', deleteFilesError)
        // Don't fail the request if file deletion fails
      }

      // Try to delete from storage (get file paths first)
      try {
        const { data: fileData } = await supabaseAdmin
          .from('files')
          .select('storage_path')
          .in('id', fileIds)

        if (fileData && fileData.length > 0) {
          const storagePaths = fileData.map(f => f.storage_path).filter(Boolean)
          if (storagePaths.length > 0) {
            await supabaseAdmin.storage
              .from('datasets')
              .remove(storagePaths)
          }
        }
      } catch (storageError) {
        console.error('Storage cleanup error:', storageError)
        // Don't fail the request if storage cleanup fails
      }
    }

    return NextResponse.json({
      message: `Successfully deleted ${reportIds.length} report(s)`,
      deletedCount: reportIds.length
    })

  } catch (error) {
    console.error('Delete reports error:', error)
    return NextResponse.json({
      error: 'Failed to delete reports',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}