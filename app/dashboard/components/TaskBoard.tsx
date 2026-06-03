"use client";

import React, { useState } from "react";
import { Database } from "@/types/database.types";
import { 
  Briefcase, 
  ListTodo, 
  Clock, 
  CheckCircle2, 
  Filter, 
  Plus, 
  Loader2, 
  Trash2 
} from "lucide-react";
import { DatePicker } from "@/components/date-picker";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type UserProfile = Database["public"]["Views"]["users"]["Row"];

interface TaskBoardProps {
  projectId: string;
  tasks: Task[] | undefined;
  users: UserProfile[] | undefined;
  tasksLoading: boolean;
  statusFilter: string;
  assigneeFilter: string;
  isCreatingTask: boolean;
  setIsCreatingTask: (val: boolean) => void;
  newTaskTitle: string;
  setNewTaskTitle: (val: string) => void;
  newTaskDesc: string;
  setNewTaskDesc: (val: string) => void;
  activeTaskPanel: string | null;
  setActiveTaskPanel: (val: string | null) => void;
  handleCreateTask: (e: React.FormEvent) => Promise<void>;
  handleDeleteTask: (taskId: string) => Promise<void>;
  handleStatusChange: (taskId: string, newStatus: Database["public"]["Enums"]["task_status"]) => Promise<void>;
  handleTaskFieldSave: (taskId: string, fields: Partial<Database["public"]["Tables"]["tasks"]["Update"]>) => Promise<void>;
  updateURL: (key: string, value: string) => void;
  setIsCreatingProject: (val: boolean) => void;
}

export function TaskBoard({
  projectId,
  tasks,
  users,
  tasksLoading,
  statusFilter,
  assigneeFilter,
  isCreatingTask,
  setIsCreatingTask,
  newTaskTitle,
  setNewTaskTitle,
  newTaskDesc,
  setNewTaskDesc,
  activeTaskPanel,
  setActiveTaskPanel,
  handleCreateTask,
  handleDeleteTask,
  handleStatusChange,
  handleTaskFieldSave,
  updateURL,
  setIsCreatingProject,
}: TaskBoardProps) {
  // Local states for inline task editing
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Local state for delete confirmation dialog
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  // Filter tasks locally by status and assignee simultaneously
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

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDesc(task.description || "");
  };

  const handleInlineSave = async (taskId: string) => {
    if (!editTitle.trim()) return;
    try {
      await handleTaskFieldSave(taskId, {
        title: editTitle.trim(),
        description: editDesc.trim() || null,
      });
      setEditingTaskId(null);
    } catch (err) {
      // Errors handled by parent bannerMutate
    }
  };

  if (!projectId) {
    return (
      <div className="p-16 text-center space-y-4 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-950/20">
        <Briefcase className="h-12 w-12 text-zinc-400 dark:text-zinc-600 mx-auto" />
        <div>
          <h4 className="font-bold text-zinc-900 dark:text-white text-base">No active projects found</h4>
          <p className="text-xs text-zinc-550 dark:text-zinc-400 mt-1">
            Projects contain tasks and workflows. Please create a project inside this workspace to begin.
          </p>
        </div>
        <button
          onClick={() => setIsCreatingProject(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 transition text-xs font-bold text-white rounded-lg cursor-pointer animate-pulse"
        >
          Create Project
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat Counters Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-zinc-300 dark:hover:border-zinc-700/50 transition">
          <div className="flex items-center justify-between text-zinc-400 dark:text-zinc-500">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">All Tasks</span>
            <Briefcase className="h-4 w-4" />
          </div>
          <p className="text-3xl font-extrabold mt-2 text-zinc-900 dark:text-white">{totalCount}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-zinc-300 dark:hover:border-zinc-700/50 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-yellow-600 dark:text-yellow-500/80">To Do</span>
            <ListTodo className="h-4 w-4 text-yellow-600 dark:text-yellow-500/80" />
          </div>
          <p className="text-3xl font-extrabold mt-2 text-zinc-900 dark:text-white">{todoCount}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-zinc-300 dark:hover:border-zinc-700/50 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-500/80">In Progress</span>
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-500/80" />
          </div>
          <p className="text-3xl font-extrabold mt-2 text-zinc-900 dark:text-white">{inProgressCount}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-zinc-300 dark:hover:border-zinc-700/50 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-green-600 dark:text-green-500/80">Completed</span>
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500/80" />
          </div>
          <p className="text-3xl font-extrabold mt-2 text-zinc-900 dark:text-white">{doneCount}</p>
        </div>
      </div>

      {/* Task list Filter actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-zinc-50 dark:bg-zinc-950 p-4 border border-zinc-200 dark:border-zinc-900 rounded-xl">
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
                  ? "bg-purple-50 dark:bg-purple-600/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/30"
                  : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-700"
              }`}
            >
              {status.replace("_", " ").toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex sm:flex-row flex-col items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 shrink-0">Assignee:</span>
          <select
            value={assigneeFilter}
            onChange={(e) => updateURL("assignee", e.target.value)}
            className="text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
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
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20">
          <h3 className="font-bold text-sm uppercase text-zinc-500 dark:text-zinc-400">Tasks Listing</h3>
          <button
            onClick={() => setIsCreatingTask(!isCreatingTask)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 transition text-xs font-bold text-white cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Task</span>
          </button>
        </div>

        {isCreatingTask && (
          <form onSubmit={handleCreateTask} className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-950/40 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Title</label>
                <input
                  type="text"
                  required
                  placeholder="Task title..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-white outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="Short description..."
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-white outline-none focus:border-purple-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreatingTask(false)}
                className="px-3 py-1.5 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold cursor-pointer"
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
            <table className="w-full text-left text-sm border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                  <th className="px-3 sm:px-6 py-4">Task Information</th>
                  <th className="px-3 sm:px-6 py-4 w-[160px]">Assignee</th>
                  <th className="px-3 sm:px-6 py-4 w-[160px]">Due Date</th>
                  <th className="px-3 sm:px-6 py-4 w-[120px]">Status</th>
                  <th className="px-3 sm:px-6 py-4 text-right w-[140px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredTasks.map((task) => {
                  const isEditing = editingTaskId === task.id;

                  return (
                    <tr 
                      key={task.id} 
                      className={`group hover:bg-zinc-50/40 dark:hover:bg-zinc-950/40 transition duration-150 ${isEditing ? "bg-zinc-50/80 dark:bg-zinc-950/80 border-l-2 border-purple-500" : ""}`}
                    >
                      {/* Task Information Cell (Inline Editors) */}
                      <td className="px-3 sm:px-6 py-4">
                        {isEditing ? (
                          <div className="space-y-2 max-w-md">
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="w-full text-xs px-2.5 py-1.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-bold outline-none focus:ring-1 focus:ring-purple-500"
                              placeholder="Task title..."
                              required
                            />
                            <input
                              type="text"
                              value={editDesc}
                              onChange={(e) => setEditDesc(e.target.value)}
                              className="w-full text-xs px-2.5 py-1.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 outline-none focus:ring-1 focus:ring-purple-500"
                              placeholder="Description (Optional)..."
                            />
                          </div>
                        ) : (
                          <div 
                            className="cursor-pointer"
                            onClick={() => startEditing(task)}
                          >
                            <p className="font-bold text-zinc-800 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition">{task.title}</p>
                            {task.description ? (
                              <p className="text-xs text-zinc-500 line-clamp-1 mt-0.5">{task.description}</p>
                            ) : (
                              <p className="text-xs text-zinc-400 dark:text-zinc-600 italic mt-0.5">Add description...</p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Assignee select dropdown */}
                      <td className="px-3 sm:px-6 py-4">
                        <select
                          value={task.assignee_id || ""}
                          onChange={(e) => handleTaskFieldSave(task.id, { assignee_id: e.target.value || null })}
                          className="text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-white rounded-lg px-2 py-1 outline-none cursor-pointer focus:ring-1 focus:ring-purple-500 w-full max-w-[80px] sm:max-w-[140px] font-medium"
                        >
                          <option value="">Unassigned</option>
                          {users?.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.full_name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Due date picker */}
                      <td className="px-3 sm:px-6 py-4">
                        <DatePicker
                          value={task.due_date}
                          onChange={(dateStr) => handleTaskFieldSave(task.id, { due_date: dateStr })}
                          align="top"
                        />
                      </td>
                      
                      {/* Status Dropdown */}
                      <td className="px-3 sm:px-6 py-4">
                        <select
                          value={task.status}
                          onChange={(e) => handleStatusChange(task.id, e.target.value as Database["public"]["Enums"]["task_status"])}
                          className="text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-white rounded-lg px-2 py-1 outline-none cursor-pointer focus:ring-1 focus:ring-purple-500 font-semibold"
                        >
                          <option value="todo">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="done">Completed</option>
                        </select>
                      </td>

                      {/* Actions cell */}
                      <td className="px-3 sm:px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleInlineSave(task.id)}
                                className="px-2.5 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingTaskId(null)}
                                className="px-2.5 py-1.5 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition cursor-pointer"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setActiveTaskPanel(activeTaskPanel === task.id ? null : task.id)}
                                className={`px-2.5 py-1.5 rounded text-xs font-semibold transition cursor-pointer ${
                                  activeTaskPanel === task.id
                                    ? "bg-purple-600 hover:bg-purple-500 text-white font-bold"
                                    : "bg-zinc-150 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                                }`}
                              >
                                Details
                              </button>
                              <button
                                onClick={() => startEditing(task)}
                                className="px-2.5 py-1.5 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setDeletingTaskId(task.id)}
                                className="p-1.5 rounded hover:bg-red-500/10 text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition cursor-pointer"
                                title="Delete Task"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-16 text-center space-y-4">
            <ListTodo className="h-12 w-12 text-zinc-400 dark:text-zinc-700 mx-auto" />
            <div>
              <h4 className="font-bold text-zinc-800 dark:text-white text-base">No tasks match filter search</h4>
              <p className="text-xs text-zinc-550 mt-1 max-w-sm mx-auto">There are no tasks matching your selected filters in this project. Create a new task to get started.</p>
            </div>
            <button
              onClick={() => setIsCreatingTask(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 transition text-xs font-bold text-white rounded-lg cursor-pointer"
            >
              Create First Task
            </button>
          </div>
        )}
      </div>

      {/* Custom Delete Confirmation Modal */}
      {deletingTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="space-y-1.5">
              <h3 className="font-extrabold text-zinc-900 dark:text-white text-base">Delete Task</h3>
              <p className="text-xs text-zinc-550 dark:text-zinc-400 leading-relaxed">
                Are you sure you want to delete this task? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingTaskId(null)}
                className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-850 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = deletingTaskId;
                  setDeletingTaskId(null);
                  await handleDeleteTask(id);
                }}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/10 transition cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
