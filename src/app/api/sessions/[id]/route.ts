import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  // Null out active_team_id first to release the deferred FK before team deletion
  await supabase.from('sessions').update({ active_team_id: null }).eq('id', id)
  await supabase.from('scores').delete().eq('session_id', id)
  await supabase.from('teams').delete().eq('session_id', id)
  await supabase.from('criteria').delete().eq('session_id', id)
  const { error } = await supabase.from('sessions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
