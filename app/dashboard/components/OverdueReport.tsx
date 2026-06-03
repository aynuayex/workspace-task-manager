"use client";

import React from "react";
import { Clock, X, User, Calendar } from "lucide-react";

export interface OverdueTask {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  due_date: string | null;
  assignee_name: string | null;
}

interface OverdueReportProps {
  overdueTasks: OverdueTask[] | null;
  setOverdueTasks: (val: OverdueTask[] | null) => void;
}

export function OverdueReport({ overdueTasks, setOverdueTasks }: OverdueReportProps) {
  if (!overdueTasks) return null;

  return (
    <div className="p-6 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Clock className="h-5 w-5 text-red-500" />
          <h3 className="font-bold text-sm tracking-wide uppercase text-red-500">
            Overdue Report (Edge Function Result)
          </h3>
        </div>
        <button
          onClick={() => setOverdueTasks(null)}
          className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {overdueTasks.length === 0 ? (
        <p className="text-xs text-zinc-500">Perfect! No overdue tasks in this project.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {overdueTasks.map((t) => (
            <div
              key={t.id}
              className="p-3 bg-white dark:bg-zinc-950 rounded-lg border border-red-500/20 hover:border-red-500/40 transition"
            >
              <div className="flex justify-between items-start">
                <h4 className="text-xs font-semibold text-zinc-900 dark:text-white truncate max-w-[85%]">
                  {t.title}
                </h4>
                <span className="text-[9px] bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded font-bold uppercase">
                  {t.status.replace("_", " ")}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-2 flex items-center gap-1">
                <User className="h-3 w-3 text-zinc-400" /> Assigned to: {t.assignee_name || "Unassigned"}
              </p>
              <p className="text-[10px] text-red-500 dark:text-red-400 font-medium mt-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Due:{" "}
                {t.due_date ? new Date(t.due_date).toLocaleDateString() : "No date"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
