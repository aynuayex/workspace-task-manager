"use client";

import React, { useState, useEffect, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { env } from "@/utils/env";
import { Database } from "@/types/database.types";
import { User } from "@supabase/supabase-js";
import useSWR from "swr";
import { 
  AlertTriangle,
  Loader2,
  RefreshCw,
  Menu,
  Edit2,
  Check,
  X
} from "lucide-react";

// Component imports
import { Sidebar } from "./components/Sidebar";
import { OverdueReport, OverdueTask } from "./components/OverdueReport";
import { TaskBoard } from "./components/TaskBoard";
import { TaskDetailPanel } from "./components/TaskDetailPanel";

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

function DashboardContent() {
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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  
  // Project editing state
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [editingProjectName, setEditingProjectName] = useState("");
  
  // New entry fields
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  
  // Edge Function response state
  const [overdueTasks, setOverdueTasks] = useState<OverdueTask[] | null>(null);
  const [loadingOverdue, setLoadingOverdue] = useState(false);
  const [overdueError, setOverdueError] = useState<string | null>(null);

  // Success / Error banner message for operations
  const [bannerMessage, setBannerMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch current user details
  const [currentUser, setCurrentUser] = useState<User | null>(null);
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

  const { data: users, error: usersError } = useSWR<UserProfile[]>(
    "users",
    usersFetcher
  );

  // Setup initial redirection if missing workspaceId or projectId
  useEffect(() => {
    if (!wsLoading && workspaces && workspaces.length > 0) {
      if (!workspaceId) {
        const url = new URL(window.location.href);
        url.searchParams.set("workspaceId", workspaces[0].id);
        router.push(url.pathname + url.search);
      }
    }
  }, [workspaces, wsLoading, workspaceId]);

  useEffect(() => {
    if (!projLoading && projects && projects.length > 0 && workspaceId) {
      if (!projectId) {
        const url = new URL(window.location.href);
        url.searchParams.set("projectId", projects[0].id);
        router.push(url.pathname + url.search);
      }
    }
  }, [projects, projLoading, projectId, workspaceId]);

  // Sync edit project name input when active project change
  const activeProject = projects?.find((p) => p.id === projectId);
  useEffect(() => {
    if (activeProject) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditingProjectName(activeProject.name);
    }
  }, [activeProject]);

  // Realtime updates via Supabase channels
  useEffect(() => {
    if (!projectId) return;

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
          mutateTasks();
        }
      )
      .subscribe();

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
    if (key === "workspaceId") {
      url.searchParams.delete("projectId");
      setOverdueTasks(null);
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
    } catch (err) {
      showBanner("error", err instanceof Error ? err.message : "Failed to create workspace");
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
    } catch (err) {
      showBanner("error", err instanceof Error ? err.message : "Failed to create project");
    }
  };

  // Actions: Create Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !projectId) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .insert({
          title: newTaskTitle.trim(),
          description: newTaskDesc.trim() || null,
          project_id: projectId,
          status: "todo"
        });

      if (error) throw error;

      setNewTaskTitle("");
      setNewTaskDesc("");
      setIsCreatingTask(false);
      mutateTasks();
      showBanner("success", "Task created successfully!");
    } catch (err) {
      showBanner("error", err instanceof Error ? err.message : "Failed to create task");
    }
  };

  // Actions: Delete Task
  const handleDeleteTask = async (taskId: string) => {

    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;

      mutateTasks();
      showBanner("success", "Task deleted successfully.");
      if (activeTaskPanel === taskId) setActiveTaskPanel(null);
    } catch (err) {
      showBanner("error", err instanceof Error ? err.message : "Failed to delete task");
    }
  };

  // Actions: Rename Active Project inline
  const handleSaveProjectName = async () => {
    if (!editingProjectName.trim() || !projectId) return;

    try {
      const { error } = await supabase
        .from("projects")
        .update({ name: editingProjectName.trim() })
        .eq("id", projectId);

      if (error) throw error;

      mutateProjects();
      setIsEditingProjectName(false);
      showBanner("success", "Project renamed successfully.");
    } catch (err) {
      showBanner("error", err instanceof Error ? err.message : "Failed to update project name");
    }
  };

  // Optimistic UI updates on status change
  const handleStatusChange = async (taskId: string, newStatus: Database["public"]["Enums"]["task_status"]) => {
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
      
      mutateTasks();
    } catch (err) {
      // Rollback on failure
      mutateTasks(originalTasks, false);
      showBanner("error", `Failed to update status. Rolled back change: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  // Actions: Inline Save fields
  const handleTaskFieldSave = async (taskId: string, fields: Partial<Database["public"]["Tables"]["tasks"]["Update"]>) => {
    if (!tasks) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .update(fields)
        .eq("id", taskId);

      if (error) throw error;

      mutateTasks();
      showBanner("success", "Task updated successfully.");
    } catch (err) {
      showBanner("error", `Failed to save task fields: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  // Invoke Supabase Edge Function to fetch overdue tasks
  const handleFetchOverdueTasks = async () => {
    if (!projectId) return;

    setLoadingOverdue(true);
    setOverdueError(null);
    setOverdueTasks(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
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
      setOverdueTasks(list as OverdueTask[]);
    } catch (err) {
      setOverdueError(err instanceof Error ? err.message : "Failed to trigger Edge Function. Make sure it is deployed.");
    } finally {
      setLoadingOverdue(false);
    }
  };

  if (wsError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-black text-zinc-900 dark:text-white p-6">
        <div className="text-center space-y-4 max-w-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-xl shadow-sm">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold">Failed to load workspaces</h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">{wsError.message}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-semibold text-white transition"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  if (wsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-black text-zinc-900 dark:text-white">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin h-10 w-10 text-purple-500 mx-auto" />
          <p className="text-zinc-500 text-sm font-medium tracking-wide">Syncing workspaces...</p>
        </div>
      </div>
    );
  }

  const activeWorkspace = workspaces?.find((w) => w.id === workspaceId);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-white">
      {/* Composed Sidebar */}
      <Sidebar
        workspaceId={workspaceId}
        projectId={projectId}
        workspaces={workspaces}
        projects={projects}
        projLoading={projLoading}
        currentUser={currentUser}
        newWorkspaceName={newWorkspaceName}
        setNewWorkspaceName={setNewWorkspaceName}
        newProjectName={newProjectName}
        setNewProjectName={setNewProjectName}
        isCreatingWorkspace={isCreatingWorkspace}
        setIsCreatingWorkspace={setIsCreatingWorkspace}
        isCreatingProject={isCreatingProject}
        setIsCreatingProject={setIsCreatingProject}
        handleCreateWorkspace={handleCreateWorkspace}
        handleCreateProject={handleCreateProject}
        updateURL={updateURL}
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-900/40 relative">
        {/* Banner Messages */}
        {bannerMessage && (
          <div className={`p-4 text-sm text-center border-b font-medium transition-all ${
            bannerMessage.type === "success" 
              ? "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20 text-green-600 dark:text-green-400" 
              : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400"
          }`}>
            {bannerMessage.text}
          </div>
        )}

        {/* Header */}
        <header className="h-16 border-b border-zinc-200 dark:border-zinc-900 px-6 md:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3 truncate">
            {/* Mobile menu trigger */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-1.5 rounded-lg md:hidden text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="truncate">
              {activeProject ? (
                <div className="flex items-center gap-2">
                  {isEditingProjectName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingProjectName}
                        onChange={(e) => setEditingProjectName(e.target.value)}
                        className="text-lg font-bold bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-0.5 text-zinc-900 dark:text-white outline-none focus:border-purple-500 w-44 sm:w-64"
                      />
                      <button
                        onClick={handleSaveProjectName}
                        className="p-1 bg-purple-600 hover:bg-purple-500 text-white rounded cursor-pointer"
                        title="Save rename"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingProjectName(false);
                          setEditingProjectName(activeProject.name);
                        }}
                        className="p-1 bg-zinc-200 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded cursor-pointer"
                        title="Cancel"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 group">
                      <h2 className="text-xl font-bold tracking-tight truncate">
                        {activeProject.name}
                      </h2>
                      <button
                        onClick={() => {
                          setIsEditingProjectName(true);
                          setEditingProjectName(activeProject.name);
                        }}
                        className="opacity-60 hover:opacity-100 focus:opacity-100 p-1 text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 transition cursor-pointer"
                        title="Rename project"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <h2 className="text-xl font-bold tracking-tight">Select a Project</h2>
              )}
              <p className="text-xs text-zinc-500 truncate">
                Workspace: <span className="font-semibold text-zinc-600 dark:text-zinc-400">{activeWorkspace?.name || "None"}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            {activeProject && (
              <button
                onClick={handleFetchOverdueTasks}
                disabled={loadingOverdue}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-600/10 text-purple-600 dark:text-purple-400 hover:bg-purple-600 hover:text-white transition text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {loadingOverdue ? (
                  <>
                    <Loader2 className="animate-spin h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Analyzing Overdue...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Check Overdue Tasks</span>
                    <span className="sm:hidden">Check</span>
                  </>
                )}
              </button>
            )}
          </div>
        </header>

        {/* Content Body Layout */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Main Board scrolling container */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
            {/* Overdue Task Panel Response */}
            {overdueError && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs flex justify-between items-center">
                <span>{overdueError}</span>
                <button onClick={() => setOverdueError(null)} className="p-1 hover:text-zinc-950 dark:hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <OverdueReport overdueTasks={overdueTasks} setOverdueTasks={setOverdueTasks} />

            {/* Composed Task Board */}
            <TaskBoard
              projectId={projectId}
              tasks={tasks}
              users={users}
              tasksLoading={tasksLoading}
              statusFilter={statusFilter}
              assigneeFilter={assigneeFilter}
              isCreatingTask={isCreatingTask}
              setIsCreatingTask={setIsCreatingTask}
              newTaskTitle={newTaskTitle}
              setNewTaskTitle={setNewTaskTitle}
              newTaskDesc={newTaskDesc}
              setNewTaskDesc={setNewTaskDesc}
              activeTaskPanel={activeTaskPanel}
              setActiveTaskPanel={setActiveTaskPanel}
              handleCreateTask={handleCreateTask}
              handleDeleteTask={handleDeleteTask}
              handleStatusChange={handleStatusChange}
              handleTaskFieldSave={handleTaskFieldSave}
              updateURL={updateURL}
              setIsCreatingProject={setIsCreatingProject}
            />
          </div>

          {/* Sliding Task Details Side Sheet */}
          {activeTaskPanel && tasks && (
            <TaskDetailPanel
              activeTaskId={activeTaskPanel}
              tasks={tasks}
              users={users}
              onClose={() => setActiveTaskPanel(null)}
              handleStatusChange={handleStatusChange}
              handleTaskFieldSave={handleTaskFieldSave}
              handleDeleteTask={handleDeleteTask}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin h-10 w-10 text-purple-500 mx-auto" />
          <p className="text-zinc-500 text-sm font-medium tracking-wide">Loading workspace dashboard...</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
