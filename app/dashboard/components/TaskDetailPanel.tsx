"use client";

import React, { useState, useEffect } from "react";
import { Database } from "@/types/database.types";
import { X, Trash2, Check, RotateCcw, Loader2 } from "lucide-react";
import { DatePicker } from "@/components/date-picker";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type UserProfile = Database["public"]["Views"]["users"]["Row"];

interface TaskDetailPanelProps {
  activeTaskId: string;
  tasks: Task[] | undefined;
  users: UserProfile[] | undefined;
  onClose: () => void;
  handleStatusChange: (taskId: string, newStatus: Database["public"]["Enums"]["task_status"]) => Promise<void>;
  handleTaskFieldSave: (taskId: string, fields: Partial<Database["public"]["Tables"]["tasks"]["Update"]>) => Promise<void>;
  handleDeleteTask: (taskId: string) => Promise<void>;
}

export function TaskDetailPanel({
  activeTaskId,
  tasks,
  users,
  onClose,
  handleStatusChange,
  handleTaskFieldSave,
  handleDeleteTask,
}: TaskDetailPanelProps) {
  const activeTask = tasks?.find((t) => t.id === activeTaskId);

  // Local editing states
  const [localTitle, setLocalTitle] = useState("");
  const [localDesc, setLocalDesc] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync state with incoming task prop
  useEffect(() => {
    if (activeTask) {
      setLocalTitle(activeTask.title);
      setLocalDesc(activeTask.description || "");
    }
  }, [activeTask?.id, activeTask?.title, activeTask?.description]);

  if (!activeTask) return null;

  const isDirty = localTitle !== activeTask.title || localDesc !== (activeTask.description || "");

  const handleSaveTextChanges = async () => {
    if (!localTitle.trim()) return;
    try {
      setIsSaving(true);
      await handleTaskFieldSave(activeTask.id, {
        title: localTitle.trim(),
        description: localDesc.trim() || null,
      });
    } catch (err) {
      // Errors handled by parent banner
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelTextChanges = () => {
    setLocalTitle(activeTask.title);
    setLocalDesc(activeTask.description || "");
  };

  return (
    <aside className="w-full md:w-80 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 flex flex-col justify-between animate-in slide-in-from-right duration-250 z-30 shrink-0 relative">
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900 pb-4">
          <h3 className="font-bold text-sm tracking-wide uppercase text-zinc-600 dark:text-zinc-400">
            Task Details
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title Field Edit */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Title
            </label>
            <input
              type="text"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-white outline-none focus:ring-1 focus:ring-purple-500 font-semibold"
            />
          </div>

          {/* Description Field Edit */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Description
            </label>
            <textarea
              value={localDesc}
              onChange={(e) => setLocalDesc(e.target.value)}
              rows={4}
              className="w-full text-xs px-3 py-2 rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-white outline-none focus:ring-1 focus:ring-purple-500 resize-none"
            />
          </div>

          {/* Save/Cancel Action Affordance for changes */}
          {isDirty && (
            <div className="flex items-center justify-end gap-2 p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 animate-in fade-in duration-200">
              <button
                type="button"
                onClick={handleCancelTextChanges}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white text-[11px] font-semibold cursor-pointer transition"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
              <button
                type="button"
                onClick={handleSaveTextChanges}
                disabled={isSaving}
                className="flex items-center gap-1 px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold cursor-pointer transition disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Save
              </button>
            </div>
          )}

          {/* Status Dropdown */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Status
            </label>
            <select
              value={activeTask.status}
              onChange={(e) =>
                handleStatusChange(activeTask.id, e.target.value as Database["public"]["Enums"]["task_status"])
              }
              className="w-full text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-white rounded px-3 py-2 outline-none cursor-pointer"
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Completed</option>
            </select>
          </div>

          {/* Assignee Dropdown */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Assignee
            </label>
            <select
              value={activeTask.assignee_id || ""}
              onChange={(e) => handleTaskFieldSave(activeTask.id, { assignee_id: e.target.value || null })}
              className="w-full text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-white rounded px-3 py-2 outline-none cursor-pointer"
            >
              <option value="">Unassigned</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Due Date Popover Picker */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Due Date
            </label>
            <DatePicker
              value={activeTask.due_date}
              onChange={(dateStr) => handleTaskFieldSave(activeTask.id, { due_date: dateStr })}
              align="top"
            />
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-zinc-100 dark:border-zinc-900">
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full py-2 bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/20 hover:border-transparent rounded-lg text-xs font-bold text-red-600 dark:text-red-400 transition cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Trash2 className="h-4 w-4" />
          <span>Delete Task</span>
        </button>
      </div>

      {/* Custom Delete Confirmation Modal overlay inside sidebar container */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="space-y-1.5">
              <h3 className="font-extrabold text-zinc-900 dark:text-white text-sm">Delete Task</h3>
              <p className="text-[11px] text-zinc-550 dark:text-zinc-400 leading-relaxed">
                Are you sure you want to delete this task? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-850 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowDeleteConfirm(false);
                  await handleDeleteTask(activeTask.id);
                }}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/10 transition cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
