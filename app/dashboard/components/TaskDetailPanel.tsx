"use client";

import React from "react";
import { Database } from "@/types/database.types";
import { X, Trash2 } from "lucide-react";
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
  if (!activeTask) return null;

  return (
    <aside className="w-full md:w-80 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 flex flex-col justify-between animate-in slide-in-from-right duration-250 z-30 shrink-0">
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900 pb-4">
          <h3 className="font-bold text-sm tracking-wide uppercase text-zinc-600 dark:text-zinc-400">
            Task Details
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
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
              value={activeTask.title}
              onChange={(e) => handleTaskFieldSave(activeTask.id, { title: e.target.value })}
              className="w-full text-xs px-3 py-2 rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-white outline-none focus:border-purple-500 font-semibold"
            />
          </div>

          {/* Description Field Edit */}
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Description
            </label>
            <textarea
              value={activeTask.description || ""}
              onChange={(e) => handleTaskFieldSave(activeTask.id, { description: e.target.value || null })}
              rows={4}
              className="w-full text-xs px-3 py-2 rounded bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-white outline-none focus:border-purple-500 resize-none"
            />
          </div>

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
            />
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-zinc-100 dark:border-zinc-900">
        <button
          onClick={() => handleDeleteTask(activeTask.id)}
          className="w-full py-2 bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/20 hover:border-transparent rounded-lg text-xs font-bold text-red-600 dark:text-red-400 transition cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Trash2 className="h-4 w-4" />
          <span>Delete Task</span>
        </button>
      </div>
    </aside>
  );
}
