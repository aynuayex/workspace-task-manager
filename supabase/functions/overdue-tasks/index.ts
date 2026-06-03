import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

interface TaskRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  assignee_id: string | null;
  due_date: string | null;
  created_at: string;
}

interface UserRow {
  id: string;
  full_name: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { project_id } = body

    if (!project_id) {
      return new Response(JSON.stringify({ error: "Missing project_id parameter" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create client using request's Auth header to enforce RLS
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: authHeader
          }
        }
      }
    )

    // Check project exists and is readable by the user (respecting RLS)
    const { data: project, error: projectError } = await supabaseClient
      .from('projects')
      .select('id')
      .eq('id', project_id)
      .maybeSingle()

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: "Project not found or access denied" }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fetch overdue tasks for this project (due_date < now, status != done)
    const { data: tasks, error: tasksError } = await supabaseClient
      .from('tasks')
      .select('*')
      .eq('project_id', project_id)
      .neq('status', 'done')
      .lt('due_date', new Date().toISOString())

    if (tasksError) {
      throw tasksError
    }

    const typedTasks = tasks as TaskRow[]

    // Fetch assignee names using our public.users view
    const assigneeIds = typedTasks.map((t: TaskRow) => t.assignee_id).filter(Boolean) as string[]
    const nameMap: Record<string, string> = {}

    if (assigneeIds.length > 0) {
      const { data: users, error: usersError } = await supabaseClient
        .from('users')
        .select('id, full_name')
        .in('id', assigneeIds)

      if (!usersError && users) {
        const typedUsers = users as UserRow[]
        typedUsers.forEach((u: UserRow) => {
          nameMap[u.id] = u.full_name
        })
      }
    }

    // Format final response array
    const responseData = typedTasks.map((t: TaskRow) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      due_date: t.due_date,
      assignee_name: t.assignee_id ? (nameMap[t.assignee_id] || "Unknown User") : "Unassigned"
    }))

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
