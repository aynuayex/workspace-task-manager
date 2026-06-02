"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { logout } from "@/app/auth/actions";
import { env } from "@/utils/env";
import { Database } from "@/types/database.types";
import useSWR from "swr";
import { 
  FolderKanban, 
  Briefcase, 
  User, 
  Calendar, 
  ListTodo, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  LogOut,
  Plus,
  Filter,
  Check,
  X,
  Loader2,
  Trash2,
  RefreshCw
} from "lucide-react";

type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];
type Project = Database["public"]["Tables"]["projects"]["Row"];
type Task = Database["public"]["Tables"]["tasks"]["Row"];
type UserProfile = Database["public"]["Views"]["users"]["Row"];

// SWR Fetchers
const workspacesFetcher = async (): Promise<Workspace[]> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
};

const projectsFetcher = async (wsId: string): Promise<Project[]> => {
  if (!wsId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("workspace_id", wsId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
};

const tasksFetcher = async (projId: string): Promise<Task[]> => {
  if (!projId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", projId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

const usersFetcher = async (): Promise<UserProfile[]> => {
  const supabase = createClient();
  const { data, error } = await supabase.from("users").select("*");
  if (error) throw error;
  return data || [];
};

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const supabase = createClient();

  // URL state query parameters
  const workspaceId = searchParams.get("workspaceId") || "";
  const projectId = searchParams.get("projectId") || "";
  const statusFilter = searchParams.get("status") || "all";
  const assigneeFilter = searchParams.get("assignee") || "all";

  // Modal / panel states
  const [activeTaskPanel, setActiveTaskPanel] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  
  // New entry fields
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  
  // Edge Function response state
  const [overdueTasks, setOverdueTasks] = useState<any[] | null>(null);
  const [loadingOverdue, setLoadingOverdue] = useState(false);
  const [overdueError, setOverdueError] = useState<string | null>(null);

  // Success / Error banner message for operations (e.g. optimistic rollback)
  const [bannerMessage, setBannerMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch current user details
  const [currentUser, setCurrentUser] = useState<any>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
    });
  }, []);

  // Show banner alert temporarily
  const showBanner = (type: "success" | "error", text: string) => {
    setBannerMessage({ type, text });
    setTimeout(() => setBannerMessage(null), 5000);
  };

  // SWR queries with explicit type annotations
  const { data: workspaces, error: wsError, isLoading: wsLoading, mutate: mutateWorkspaces } = useSWR<Workspace[]>(
    "workspaces",
    workspacesFetcher
  );

  const { data: projects, error: projError, isLoading: projLoading, mutate: mutateProjects } = useSWR<Project[]>(
    workspaceId ? ["projects", workspaceId] : null,
    ([, wsId]) => projectsFetcher(wsId as string)
  );

  const { data: tasks, error: tasksError, isLoading: tasksLoading, mutate: mutateTasks } = useSWR<Task[]>(
    projectId ? ["tasks", projectId] : null,
    ([, projId]) => tasksFetcher(projId as string)
  );

  const { data: users, error: usersError, isLoading: usersLoading } = useSWR<UserProfile[]>(
    "users",
    usersFetcher
  );

  // Setup initial redirection if missing workspaceId or projectId
  useEffect(() => {
    if (!wsLoading && workspaces && workspaces.length > 0) {
      if (!workspaceId) {
        // Redirect to first workspace
        const url = new URL(window.location.href);
        url.searchParams.set("workspaceId", workspaces[0].id);
        router.push(url.pathname + url.search);
      }
    }
  }, [workspaces, wsLoading, workspaceId]);

  useEffect(() => {
    if (!projLoading && projects && projects.length > 0 && workspaceId) {
      if (!projectId) {
        // Redirect to first project in active workspace
        const url = new URL(window.location.href);
        url.searchParams.set("projectId", projects[0].id);
        router.push(url.pathname + url.search);
      }
    }
  }, [projects, projLoading, projectId, workspaceId]);

  // R3: Realtime updates via Supabase channels
  useEffect(() => {
    if (!projectId) return;

    // Subscribe to task updates in this project
    const channel = supabase
      .channel(`tasks_project_${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `project_id=eq.${projectId}`
        },
        () => {
          // Re-fetch SWR tasks cache on remote change
          mutateTasks();
        }
      )
      .subscribe();

    // Clean up subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  // URL state update helper
  const updateURL = (key: string, value: string) => {
    const url = new URL(window.location.href);
    if (value === "all" || !value) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
    // If switching workspace, clear the project so it defaults to the first project of new workspace
    if (key === "workspaceId") {
      url.searchParams.delete("projectId");
      setOverdueTasks(null); // Clear overdue results
    }
    startTransition(() => {
      router.push(url.pathname + url.search);
    });
  };

  // Actions: Create Workspace
  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    try {
      const { data, error } = await supabase
        .from("workspaces")
        .insert({ name: newWorkspaceName.trim() })
        .select()
        .single();

      if (error) throw error;

      setNewWorkspaceName("");
      setIsCreatingWorkspace(false);
      mutateWorkspaces();
      showBanner("success", "Workspace created successfully!");
      updateURL("workspaceId", data.id);
    } catch (err: any) {
      showBanner("error", err?.message || "Failed to create workspace");
    }
  };

  // Actions: Create Project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !workspaceId) return;

    try {
      const { data, error } = await supabase
        .from("projects")
        .insert({ name: newProjectName.trim(), workspace_id: workspaceId })
        .select()
        .single();

      if (error) throw error;

      setNewProjectName("");
      setIsCreatingProject(false);
      mutateProjects();
      showBanner("success", "Project created successfully!");
      updateURL("projectId", data.id);
    } catch (err: any) {
      showBanner("error", err?.message || "Failed to create project");
    }
  };

  // Actions: Create Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !projectId) return;

    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title: newTaskTitle.trim(),
          description: newTaskDesc.trim() || null,
          project_id: projectId,
          status: "todo"
        })
        .select()
        .single();

      if (error) throw error;

      setNewTaskTitle("");
      setNewTaskDesc("");
      setIsCreatingTask(false);
      mutateTasks();
      showBanner("success", "Task created successfully!");
    } catch (err: any) {
      showBanner("error", err?.message || "Failed to create task");
    }
  };

  // Actions: Delete Task
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;

      mutateTasks();
      showBanner("success", "Task deleted successfully.");
      if (activeTaskPanel === taskId) setActiveTaskPanel(null);
    } catch (err: any) {
      showBanner("error", err?.message || "Failed to delete task");
    }
  };

  // R7: Optimistic UI updates on status change
  const handleStatusChange = async (taskId: string, newStatus: "todo" | "in_progress" | "done") => {
    if (!tasks) return;

    const originalTasks = [...tasks];
    
    // Perform local state update immediately
    const updatedTasks = tasks.map((t) => 
      t.id === taskId ? { ...t, status: newStatus } : t
    );
    mutateTasks(updatedTasks, false);

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus })
        .eq("id", taskId);

      if (error) throw error;
      
      // Refresh SWR data cache
      mutateTasks();
    } catch (err: any) {
      // Rollback on failure with warning banner
      mutateTasks(originalTasks, false);
      showBanner("error", `Failed to update status. Rolled back change: ${err.message}`);
    }
  };

  // Actions: Inline Save fields
  const handleTaskFieldSave = async (taskId: string, fields: any) => {
    if (!tasks) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .update(fields)
        .eq("id", taskId);

      if (error) throw error;

      mutateTasks();
      showBanner("success", "Task updated successfully.");
    } catch (err: any) {
      showBanner("error", `Failed to save task fields: ${err.message}`);
    }
  };

  // R8: Invoke Supabase Edge Function to fetch overdue tasks
  const handleFetchOverdueTasks = async () => {
    if (!projectId) return;

    setLoadingOverdue(true);
    setOverdueError(null);
    setOverdueTasks(null);

    try {
      // Read cookies directly or get user session jwt
      const { data: { session } } = await supabase.auth.getSession();
      
      // Call Supabase Edge Function using fetch (since supabase.functions.invoke accesses edge endpoint)
      // Standard local Supabase Edge Functions serve on: http://localhost:54321/functions/v1/overdue-tasks
      // Online functions serve on: https://[project_id].supabase.co/functions/v1/overdue-tasks
      const funcUrl = `${env.supabaseUrl}/functions/v1/overdue-tasks`;
      
      const response = await fetch(funcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ""}`
        },
        body: JSON.stringify({ project_id: projectId })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `Server responded with ${response.status}`);
      }

      const list = await response.json();
      setOverdueTasks(list);
    } catch (err: any) {
      setOverdueError(err?.message || "Failed to trigger Edge Function. Make sure it is deployed.");
    } finally {
      setLoadingOverdue(false);
    }
  };

  // Loading, Empty, and Error States (R6)
  if (wsError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white p-6">
        <div className="text-center space-y-4 max-w-md bg-zinc-900 border border-zinc-800 p-8 rounded-xl">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold">Failed to load workspaces</h2>
          <p className="text-zinc-400 text-sm">{wsError.message}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-semibold transition"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  if (wsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin h-10 w-10 text-purple-500 mx-auto" />
          <p className="text-zinc-500 text-sm font-medium tracking-wide">Syncing workspaces...</p>
        </div>
      </div>
    );
  }

  // Filter tasks locally by status and assignee simultaneously (Requirement R4)
  const activeProject = projects?.find((p) => p.id === projectId);
  const activeWorkspace = workspaces?.find((w) => w.id === workspaceId);
  const filteredTasks = tasks
    ? tasks.filter((task) => {
        const matchesStatus = statusFilter === "all" || task.status === statusFilter;
        const matchesAssignee =
          assigneeFilter === "all" ||
          (assigneeFilter === "unassigned" && !task.assignee_id) ||
          task.assignee_id === assigneeFilter;
        return matchesStatus && matchesAssignee;
      })
    : [];

  // Calculate task counts for stats
  const todoCount = tasks?.filter((t) => t.status === "todo").length || 0;
  const inProgressCount = tasks?.filter((t) => t.status === "in_progress").length || 0;
  const doneCount = tasks?.filter((t) => t.status === "done").length || 0;
  const totalCount = tasks?.length || 0;

  return (
    <div className="flex min-h-screen bg-black font-sans text-white">
      {/* Sidebar Nav */}
      <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col justify-between">
        <div className="p-6 space-y-6">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-600/30">
              <span className="font-extrabold text-sm tracking-tighter">S</span>
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">Synapse</span>
          </div>

          {/* Workspace Switcher */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Workspace</label>
              <button 
                onClick={() => setIsCreatingWorkspace(!isCreatingWorkspace)} 
                className="text-purple-400 hover:text-white transition"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {isCreatingWorkspace && (
              <form onSubmit={handleCreateWorkspace} className="flex gap-2">
                <input
                  type="text"
                  placeholder="New workspace..."
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  className="flex-1 text-xs px-2 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-white outline-none focus:border-purple-500"
                />
                <button type="submit" className="p-1.5 bg-purple-600 hover:bg-purple-500 rounded text-white cursor-pointer">
                  <Check className="h-3 w-3" />
                </button>
              </form>
            )}

            <div className="relative">
              <select
                value={workspaceId}
                onChange={(e) => updateURL("workspaceId", e.target.value)}
                className="w-full text-sm px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition appearance-none cursor-pointer"
              >
                {workspaces?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Project List / Switcher */}
          <div className="space-y-2 pt-2 border-t border-zinc-900">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Projects</label>
              <button 
                onClick={() => setIsCreatingProject(!isCreatingProject)} 
                className="text-purple-400 hover:text-white transition"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {isCreatingProject && (
              <form onSubmit={handleCreateProject} className="flex gap-2">
                <input
                  type="text"
                  placeholder="New project name..."
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="flex-1 text-xs px-2 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-white outline-none focus:border-purple-500"
                />
                <button type="submit" className="p-1.5 bg-purple-600 hover:bg-purple-500 rounded text-white cursor-pointer">
                  <Check className="h-3 w-3" />
                </button>
              </form>
            )}

            <div className="space-y-1">
              {projLoading ? (
                <div className="flex items-center space-x-2 py-2 text-xs text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500" />
                  <span>Loading projects...</span>
                </div>
              ) : projects && projects.length > 0 ? (
                projects.map((proj) => {
                  const isActive = proj.id === projectId;
                  return (
                    <button
                      key={proj.id}
                      onClick={() => updateURL("projectId", proj.id)}
                      className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-sm text-left transition duration-150 cursor-pointer ${
                        isActive 
                          ? "bg-purple-600/10 text-purple-400 font-semibold border border-purple-500/20" 
                          : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                      }`}
                    >
                      <FolderKanban className="h-4 w-4 shrink-0" />
                      <span className="truncate">{proj.name}</span>
                    </button>
                  );
                })
              ) : (
                <div className="p-3 text-xs text-zinc-600 text-center border border-dashed border-zinc-900 rounded-lg">
                  No projects in workspace.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-zinc-900 bg-zinc-950 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 truncate max-w-[170px]">
            <div className="h-8 w-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <User className="h-4 w-4 text-purple-400" />
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-white truncate">
                {currentUser?.user_metadata?.full_name || currentUser?.email?.split("@")[0] || "User"}
              </p>
              <p className="text-[10px] text-zinc-500 truncate">{currentUser?.email}</p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="p-1.5 rounded bg-zinc-900 border border-zinc-800 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 text-zinc-500 transition cursor-pointer"
            title="Log Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 flex flex-col min-w-0 bg-zinc-950/20">
        {/* Banner Messages */}
        {bannerMessage && (
          <div className={`p-4 text-sm text-center border-b font-medium animate-pulse ${
            bannerMessage.type === "success" 
              ? "bg-green-500/10 border-green-500/20 text-green-400" 
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}>
            {bannerMessage.text}
          </div>
        )}

        {/* Header */}
        <header className="h-16 border-b border-zinc-900 px-8 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              {activeProject ? activeProject.name : "Select a Project"}
            </h2>
            <p className="text-xs text-zinc-500">
              Workspace: <span className="font-semibold text-zinc-400">{activeWorkspace?.name || "None"}</span>
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {activeProject && (
              <button
                onClick={handleFetchOverdueTasks}
                disabled={loadingOverdue}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-600/10 text-purple-400 hover:bg-purple-600 hover:text-white transition text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {loadingOverdue ? (
                  <>
                    <Loader2 className="animate-spin h-3.5 w-3.5" />
                    <span>Analyzing Overdue...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Check Overdue Tasks</span>
                  </>
                )}
              </button>
            )}
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* Overdue Task Panel (Edge Function Trigger response) */}
          {overdueError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex justify-between items-center">
              <span>{overdueError}</span>
              <button onClick={() => setOverdueError(null)} className="p-1 hover:text-white"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}

          {overdueTasks && (
            <div className="p-6 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-red-400" />
                  <h3 className="font-bold text-sm tracking-wide uppercase text-red-400">Overdue Report (Edge Function Result)</h3>
                </div>
                <button onClick={() => setOverdueTasks(null)} className="text-zinc-500 hover:text-white transition"><X className="h-4 w-4" /></button>
              </div>

              {overdueTasks.length === 0 ? (
                <p className="text-xs text-zinc-500">Perfect! No overdue tasks in this project.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {overdueTasks.map((t: any) => (
                    <div key={t.id} className="p-3 bg-zinc-950 rounded-lg border border-red-500/20 hover:border-red-500/40 transition">
                      <div className="flex justify-between items-start">
                        <h4 className="text-xs font-semibold text-white truncate max-w-[80%]">{t.title}</h4>
                        <span className="text-[9px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded font-bold uppercase">{t.status}</span>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-2 flex items-center gap-1">
                        <User className="h-3 w-3" /> Assigned to: {t.assignee_name || "Unassigned"}
                      </p>
                      <p className="text-[10px] text-red-400 font-medium mt-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Due: {t.due_date ? new Date(t.due_date).toLocaleDateString() : "No date"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* R6: Stat cards (or full view loading/error) */}
          {projectId ? (
            <>
              {/* Stat Counters Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700/50 transition">
                  <div className="flex items-center justify-between text-zinc-500">
                    <span className="text-xs font-bold uppercase tracking-wider">All Tasks</span>
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <p className="text-3xl font-extrabold mt-2 text-white">{totalCount}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700/50 transition">
                  <div className="flex items-center justify-between text-zinc-500">
                    <span className="text-xs font-bold uppercase tracking-wider text-yellow-500/80">To Do</span>
                    <ListTodo className="h-4 w-4 text-yellow-500/80" />
                  </div>
                  <p className="text-3xl font-extrabold mt-2 text-white">{todoCount}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700/50 transition">
                  <div className="flex items-center justify-between text-zinc-500">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-500/80">In Progress</span>
                    <Clock className="h-4 w-4 text-blue-500/80" />
                  </div>
                  <p className="text-3xl font-extrabold mt-2 text-white">{inProgressCount}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700/50 transition">
                  <div className="flex items-center justify-between text-zinc-500">
                    <span className="text-xs font-bold uppercase tracking-wider text-green-500/80">Completed</span>
                    <CheckCircle2 className="h-4 w-4 text-green-500/80" />
                  </div>
                  <p className="text-3xl font-extrabold mt-2 text-white">{doneCount}</p>
                </div>
              </div>

              {/* Task list Filter actions (Requirement R4 - Syncs with URL query params) */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-zinc-950 p-4 border border-zinc-900 rounded-xl">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5 mr-2">
                    <Filter className="h-3.5 w-3.5" /> Filters:
                  </span>
                  
                  {/* Status Filters */}
                  {["all", "todo", "in_progress", "done"].map((status) => (
                    <button
                      key={status}
                      onClick={() => updateURL("status", status)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition ${
                        statusFilter === status
                          ? "bg-purple-600/10 text-purple-400 border-purple-500/30"
                          : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {status.replace("_", " ").toUpperCase()}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Assignee:</span>
                  <select
                    value={assigneeFilter}
                    onChange={(e) => updateURL("assignee", e.target.value)}
                    className="text-xs bg-zinc-900 border border-zinc-800 text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                  >
                    <option value="all">All Assignees</option>
                    <option value="unassigned">Unassigned Only</option>
                    {users?.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tasks List */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-850">
                  <h3 className="font-bold text-sm uppercase text-zinc-400">Tasks Listing</h3>
                  <button
                    onClick={() => setIsCreatingTask(!isCreatingTask)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 transition text-xs font-bold cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Task</span>
                  </button>
                </div>

                {isCreatingTask && (
                  <form onSubmit={handleCreateTask} className="p-6 border-b border-zinc-850 bg-zinc-950/40 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Title</label>
                        <input
                          type="text"
                          required
                          placeholder="Task title..."
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          className="w-full text-xs px-3 py-2 rounded bg-zinc-900 border border-zinc-800 text-white outline-none focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Description (Optional)</label>
                        <input
                          type="text"
                          placeholder="Short description..."
                          value={newTaskDesc}
                          onChange={(e) => setNewTaskDesc(e.target.value)}
                          className="w-full text-xs px-3 py-2 rounded bg-zinc-900 border border-zinc-800 text-white outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsCreatingTask(false)}
                        className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white cursor-pointer"
                      >
                        Create Task
                      </button>
                    </div>
                  </form>
                )}

                {tasksLoading ? (
                  <div className="p-8 text-center text-zinc-500 space-y-2">
                    <Loader2 className="animate-spin h-8 w-8 text-purple-500 mx-auto" />
                    <p className="text-xs">Fetching task records...</p>
                  </div>
                ) : filteredTasks.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-850 bg-zinc-950/20 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                          <th className="px-6 py-4 w-1/4">Status</th>
                          <th className="px-6 py-4 w-2/5">Task Information</th>
                          <th className="px-6 py-4">Assignee</th>
                          <th className="px-6 py-4">Due Date</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-850">
                        {filteredTasks.map((task) => {
                          const taskAssignee = users?.find((u) => u.id === task.assignee_id);
                          const isPanelOpen = activeTaskPanel === task.id;

                          return (
                            <tr 
                              key={task.id} 
                              className={`group hover:bg-zinc-950/40 transition duration-150 ${isPanelOpen ? "bg-zinc-950/80 border-l-2 border-purple-500" : ""}`}
                            >
                              {/* R5: Inline status editor */}
                              <td className="px-6 py-4">
                                <select
                                  value={task.status}
                                  onChange={(e) => handleStatusChange(task.id, e.target.value as any)}
                                  className="text-xs bg-zinc-900 border border-zinc-800 text-white rounded-lg px-2 py-1 outline-none cursor-pointer focus:ring-1 focus:ring-purple-500 font-semibold"
                                >
                                  <option value="todo">To Do</option>
                                  <option value="in_progress">In Progress</option>
                                  <option value="done">Completed</option>
                                </select>
                              </td>

                              {/* Title / Description details (clickable to view/edit detail panel) */}
                              <td 
                                className="px-6 py-4 cursor-pointer"
                                onClick={() => setActiveTaskPanel(isPanelOpen ? null : task.id)}
                              >
                                <div>
                                  <p className="font-bold text-white group-hover:text-purple-400 transition">{task.title}</p>
                                  {task.description && (
                                    <p className="text-xs text-zinc-500 line-clamp-1 mt-0.5">{task.description}</p>
                                  )}
                                </div>
                              </td>

                              {/* R5: Inline Assignee selector */}
                              <td className="px-6 py-4">
                                <select
                                  value={task.assignee_id || ""}
                                  onChange={(e) => handleTaskFieldSave(task.id, { assignee_id: e.target.value || null })}
                                  className="text-xs bg-zinc-900 border border-zinc-800 text-white rounded-lg px-2.5 py-1.5 outline-none cursor-pointer focus:ring-1 focus:ring-purple-500 w-full max-w-[180px] font-medium"
                                >
                                  <option value="">Unassigned</option>
                                  {users?.map((u) => (
                                    <option key={u.id} value={u.id}>
                                      {u.full_name}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* R5: Inline Due date selector */}
                              <td className="px-6 py-4">
                                <input
                                  type="date"
                                  value={task.due_date ? task.due_date.substring(0, 10) : ""}
                                  onChange={(e) => handleTaskFieldSave(task.id, { due_date: e.target.value || null })}
                                  className="text-xs bg-zinc-900 border border-zinc-800 text-white rounded-lg px-2.5 py-1.5 outline-none cursor-pointer focus:ring-1 focus:ring-purple-500 font-medium"
                                />
                              </td>

                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end space-x-2">
                                  <button
                                    onClick={() => setActiveTaskPanel(isPanelOpen ? null : task.id)}
                                    className="px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold transition cursor-pointer"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTask(task.id)}
                                    className="p-1.5 rounded hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition cursor-pointer"
                                    title="Delete Task"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  // R6: Empty state with CTA
                  <div className="p-16 text-center space-y-4">
                    <ListTodo className="h-12 w-12 text-zinc-700 mx-auto" />
                    <div>
                      <h4 className="font-bold text-white text-base">No tasks match filter search</h4>
                      <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">There are no tasks matching your selected filters in this project. Create a new task to get started.</p>
                    </div>
                    <button
                      onClick={() => setIsCreatingTask(true)}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 transition text-xs font-bold rounded-lg cursor-pointer"
                    >
                      Create First Task
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            // Workspace has no projects yet
            <div className="p-16 text-center space-y-4 border border-dashed border-zinc-800 rounded-2xl">
              <Briefcase className="h-12 w-12 text-zinc-700 mx-auto" />
              <div>
                <h4 className="font-bold text-white text-base">No active projects found</h4>
                <p className="text-xs text-zinc-500 mt-1">Projects contain tasks and workflows. Please create a project inside this workspace to begin.</p>
              </div>
              <button
                onClick={() => setIsCreatingProject(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 transition text-xs font-bold rounded-lg cursor-pointer animate-pulse"
              >
                Create Project
              </button>
            </div>
          )}
        </div>
      </main>

      {/* R5: Task Detail Panel (inline editing panel on right sidebar) */}
      {activeTaskPanel && tasks && (
        (() => {
          const activeTask = tasks.find((t) => t.id === activeTaskPanel);
          if (!activeTask) return null;

          return (
            <aside className="w-80 border-l border-zinc-800 bg-zinc-950 p-6 flex flex-col justify-between animate-in slide-in-from-right duration-250">
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                  <h3 className="font-bold text-sm tracking-wide uppercase text-zinc-400">Task Details</h3>
                  <button 
                    onClick={() => setActiveTaskPanel(null)} 
                    className="p-1 text-zinc-500 hover:text-white transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Title Field Edit */}
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Title</label>
                    <input
                      type="text"
                      value={activeTask.title}
                      onChange={(e) => handleTaskFieldSave(activeTask.id, { title: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded bg-zinc-900 border border-zinc-800 text-white outline-none focus:border-purple-500 font-semibold"
                    />
                  </div>

                  {/* Description Field Edit */}
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Description</label>
                    <textarea
                      value={activeTask.description || ""}
                      onChange={(e) => handleTaskFieldSave(activeTask.id, { description: e.target.value || null })}
                      rows={4}
                      className="w-full text-xs px-3 py-2 rounded bg-zinc-900 border border-zinc-800 text-white outline-none focus:border-purple-500 resize-none"
                    />
                  </div>

                  {/* Status Dropdown */}
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Status</label>
                    <select
                      value={activeTask.status}
                      onChange={(e) => handleStatusChange(activeTask.id, e.target.value as any)}
                      className="w-full text-xs bg-zinc-900 border border-zinc-800 text-white rounded px-3 py-2 outline-none cursor-pointer"
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Completed</option>
                    </select>
                  </div>

                  {/* Assignee Dropdown */}
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Assignee</label>
                    <select
                      value={activeTask.assignee_id || ""}
                      onChange={(e) => handleTaskFieldSave(activeTask.id, { assignee_id: e.target.value || null })}
                      className="w-full text-xs bg-zinc-900 border border-zinc-800 text-white rounded px-3 py-2 outline-none cursor-pointer"
                    >
                      <option value="">Unassigned</option>
                      {users?.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Due Date Input */}
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Due Date</label>
                    <input
                      type="date"
                      value={activeTask.due_date ? activeTask.due_date.substring(0, 10) : ""}
                      onChange={(e) => handleTaskFieldSave(activeTask.id, { due_date: e.target.value || null })}
                      className="w-full text-xs bg-zinc-900 border border-zinc-800 text-white rounded px-3 py-2 outline-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-900">
                <button
                  onClick={() => handleDeleteTask(activeTask.id)}
                  className="w-full py-2 bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/20 hover:border-transparent rounded-lg text-xs font-bold text-red-400 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete Task</span>
                </button>
              </div>
            </aside>
          );
        })()
      )}
    </div>
  );
}
