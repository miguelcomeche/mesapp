import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bridge-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const expectedToken = Deno.env.get('PRINT_BRIDGE_TOKEN')
  const providedToken = req.headers.get('x-bridge-token')
  if (!expectedToken || providedToken !== expectedToken) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let action: string = 'pull'
  let body: any = null
  if (req.method === 'POST') {
    try {
      body = await req.json()
      if (body?.action) action = body.action
    } catch {
      // empty body -> default pull
    }
  }

  try {
    if (action === 'pull') {
      const { data: pending, error: selErr } = await supabase
        .from('print_jobs')
        .select('id, destination, content, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(10)
      if (selErr) throw selErr

      const ids = (pending ?? []).map((r: any) => r.id)
      if (ids.length > 0) {
        const { error: updErr } = await supabase
          .from('print_jobs')
          .update({ status: 'printing' })
          .in('id', ids)
        if (updErr) throw updErr
      }

      return json(pending ?? [])
    }

    if (action === 'ack') {
      const id = body?.id
      const ok = body?.ok
      if (!id || typeof ok !== 'boolean') {
        return json({ error: 'Missing id or ok' }, 400)
      }
      const patch: Record<string, unknown> = ok
        ? { status: 'done', printed_at: new Date().toISOString() }
        : { status: 'error' }
      const { error } = await supabase.from('print_jobs').update(patch).eq('id', id)
      if (error) throw error
      return json({ success: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})