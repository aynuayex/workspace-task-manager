"use client";

import React from "react";
import { User } from "@supabase/supabase-js";
import { useTheme } from "next-themes";
import { logout } from "@/app/auth/actions";
import { Database } from "@/types/database.types";
import { 
  FolderKanban, 
  User as UserIcon, 
  LogOut, 
  Plus, 
  Check, 
  Loader2, 
  Sun, 
  Moon, 
  X 
} from "lucide-react";

type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];
type Project = Database["public"]["Tables"]["projects"]["Row"];

interface SidebarProps {
  workspaceId: string;
  projectId: string;
  workspaces: Workspace[] | undefined;
  projects: Project[] | undefined;
  projLoading: boolean;
  currentUser: User | null;
  newWorkspaceName: string;
  setNewWorkspaceName: (val: string) => void;
  newProjectName: string;
  setNewProjectName: (val: string) => void;
  isCreatingWorkspace: boolean;
  setIsCreatingWorkspace: (val: boolean) => void;
  isCreatingProject: boolean;
  setIsCreatingProject: (val: boolean) => void;
  handleCreateWorkspace: (e: React.FormEvent) => Promise<void>;
  handleCreateProject: (e: React.FormEvent) => Promise<void>;
  updateURL: (key: string, value: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({
  workspaceId,
  projectId,
  workspaces,
  projects,
  projLoading,
  currentUser,
  newWorkspaceName,
  setNewWorkspaceName,
  newProjectName,
  setNewProjectName,
  isCreatingWorkspace,
  setIsCreatingWorkspace,
  isCreatingProject,
  setIsCreatingProject,
  handleCreateWorkspace,
  handleCreateProject,
  updateURL,
  isOpen,
  onClose,
}: SidebarProps) {
  const { theme, setTheme } = useTheme();

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 md:hidden backdrop-blur-sm transition-opacity duration-200"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col justify-between border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 transition-transform duration-300 md:static md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 space-y-6">
          {/* Logo Section */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-600/30">
                <span className="font-extrabold text-sm tracking-tighter text-white">S</span>
              </div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
                Synapse
              </span>
            </div>
            {/* Mobile Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg md:hidden text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Workspace Switcher */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Workspace
              </label>
              <button
                onClick={() => setIsCreatingWorkspace(!isCreatingWorkspace)}
                className="text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-white transition"
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
                  className="flex-1 text-xs px-2 py-1.5 rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  className="p-1.5 bg-purple-600 hover:bg-purple-500 rounded text-white cursor-pointer"
                >
                  <Check className="h-3 w-3" />
                </button>
              </form>
            )}

            <div className="relative">
              <select
                value={workspaceId}
                onChange={(e) => {
                  updateURL("workspaceId", e.target.value);
                  onClose();
                }}
                className="w-full text-sm px-3 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition appearance-none cursor-pointer"
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
          <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-900">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Projects
              </label>
              <button
                onClick={() => setIsCreatingProject(!isCreatingProject)}
                className="text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-white transition"
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
                  className="flex-1 text-xs px-2 py-1.5 rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  className="p-1.5 bg-purple-600 hover:bg-purple-500 rounded text-white cursor-pointer"
                >
                  <Check className="h-3 w-3" />
                </button>
              </form>
            )}

            <div className="space-y-1">
              {projLoading ? (
                <div className="flex items-center space-x-2 py-2 text-xs text-zinc-400 dark:text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500" />
                  <span>Loading projects...</span>
                </div>
              ) : projects && projects.length > 0 ? (
                projects.map((proj) => {
                  const isActive = proj.id === projectId;
                  return (
                    <button
                      key={proj.id}
                      onClick={() => {
                        updateURL("projectId", proj.id);
                        onClose();
                      }}
                      className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-sm text-left transition duration-150 cursor-pointer ${
                        isActive
                          ? "bg-purple-50 dark:bg-purple-600/10 text-purple-600 dark:text-purple-400 font-semibold border border-purple-200 dark:border-purple-500/20"
                          : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900"
                      }`}
                    >
                      <FolderKanban className="h-4 w-4 shrink-0 text-zinc-500" />
                      <span className="truncate">{proj.name}</span>
                    </button>
                  );
                })
              ) : (
                <div className="p-3 text-xs text-zinc-400 dark:text-zinc-600 text-center border border-dashed border-zinc-200 dark:border-zinc-900 rounded-lg">
                  No projects in workspace.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* User Card, Theme Toggle & Logout */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-900 bg-zinc-50 dark:bg-zinc-950/40 flex items-center justify-between gap-1">
          <div className="flex items-center space-x-2.5 truncate max-w-[140px]">
            <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 flex items-center justify-center shrink-0">
              <UserIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-zinc-800 dark:text-white truncate">
                {currentUser?.user_metadata?.full_name || currentUser?.email?.split("@")[0] || "User"}
              </p>
              <p className="text-[10px] text-zinc-500 truncate">{currentUser?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-1.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition cursor-pointer"
              title="Toggle Theme"
            >
              <span className="dark:hidden">
                <Moon className="h-4 w-4" />
              </span>
              <span className="hidden dark:block">
                <Sun className="h-4 w-4" />
              </span>
            </button>

            {/* Logout Button */}
            <button
              onClick={() => logout()}
              className="p-1.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-600 dark:hover:text-red-400 text-zinc-500 transition cursor-pointer"
              title="Log Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
