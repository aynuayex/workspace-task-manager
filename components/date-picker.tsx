"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";

interface DatePickerProps {
  value: string | null;
  onChange: (dateStr: string | null) => void;
  align?: "top" | "bottom";
}

export function DatePicker({ value, onChange, align = "bottom" }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<"days" | "months" | "years">("days");
  const [baseYear, setBaseYear] = useState(new Date().getFullYear());
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Parse current date value
  const selectedDate = value ? new Date(value) : null;

  // Toggle calendar popup
  const toggleOpen = () => {
    setIsOpen(!isOpen);
    setViewMode("days");
    setBaseYear(currentMonth.getFullYear());
  };

  // Close calendar if clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        const portalEl = document.getElementById("synapse-datepicker-portal");
        if (portalEl && portalEl.contains(event.target as Node)) {
          return;
        }
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Sync baseYear when currentMonth changes
  useEffect(() => {
    setBaseYear(currentMonth.getFullYear());
  }, [currentMonth]);

  // Update coords dynamically when opening or resizing
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const updatePosition = () => {
        if (!buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        const popoverHeight = 310;
        const popoverWidth = 280;

        const spaceBelow = window.innerHeight - rect.bottom;
        
        let top = rect.bottom + window.scrollY + 4;
        if (spaceBelow < popoverHeight && rect.top > popoverHeight) {
          top = rect.top + window.scrollY - popoverHeight - 4;
        }

        let left = rect.left + window.scrollX;
        if (left + popoverWidth > window.innerWidth) {
          left = window.innerWidth - popoverWidth - 16;
        }
        if (left < 0) left = 16;

        setCoords({ top, left });
      };

      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }
  }, [isOpen]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Unified chevron navigation handler
  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMode === "days") {
      setCurrentMonth(new Date(year, month - 1, 1));
    } else if (viewMode === "months") {
      setCurrentMonth(new Date(year - 1, month, 1));
    } else if (viewMode === "years") {
      setBaseYear(baseYear - 16);
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMode === "days") {
      setCurrentMonth(new Date(year, month + 1, 1));
    } else if (viewMode === "months") {
      setCurrentMonth(new Date(year + 1, month, 1));
    } else if (viewMode === "years") {
      setBaseYear(baseYear + 16);
    }
  };

  const handleSelectDay = (day: number) => {
    const newDate = new Date(Date.UTC(year, month, day));
    const dateString = newDate.toISOString().split("T")[0];
    onChange(dateString);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setIsOpen(false);
  };

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="relative inline-block w-full" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        className="w-full flex items-center justify-between gap-2 text-xs text-left px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-700 transition focus:ring-1 focus:ring-purple-500 outline-none cursor-pointer"
      >
        <span className="flex items-center gap-2 truncate">
          <CalendarIcon className="h-3.5 w-3.5 text-zinc-500" />
          {selectedDate ? formatDate(selectedDate) : <span className="text-zinc-400 dark:text-zinc-500">Pick a date</span>}
        </span>
        {value && (
          <span
            onClick={handleClear}
            className="p-0.5 rounded-full hover:bg-zinc-150 dark:hover:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition"
          >
            <X className="h-3 w-3" />
          </span>
        )}
      </button>

      {isOpen && typeof document !== "undefined" && createPortal(
        <div
          id="synapse-datepicker-portal"
          style={{
            position: "absolute",
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            zIndex: 9999,
          }}
          className="p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl w-[280px] animate-in fade-in duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1 select-none">
              <button
                type="button"
                onClick={() => setViewMode(viewMode === "months" ? "days" : "months")}
                className={`text-xs font-bold px-2 py-1 rounded transition cursor-pointer ${
                  viewMode === "months"
                    ? "bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400"
                    : "text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900"
                }`}
              >
                {viewMode === "years" ? "Month" : monthNames[month].substring(0, 3)}
              </button>
              <button
                type="button"
                onClick={() => setViewMode(viewMode === "years" ? "days" : "years")}
                className={`text-xs font-bold px-2 py-1 rounded transition cursor-pointer ${
                  viewMode === "years"
                    ? "bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400"
                    : "text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900"
                }`}
              >
                {viewMode === "years" ? `${baseYear - 8} - ${baseYear + 7}` : year}
              </button>
            </div>
            
            {/* Always show chevrons to navigate corresponding view */}
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={handlePrev}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white transition cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white transition cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Render Days Grid */}
          {viewMode === "days" && (
            <>
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-2">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {days.map((day, idx) => {
                  if (day === null) {
                    return <span key={`empty-${idx}`} />;
                  }

                  const isSelected =
                    selectedDate &&
                    selectedDate.getUTCDate() === day &&
                    selectedDate.getUTCMonth() === month &&
                    selectedDate.getUTCFullYear() === year;

                  const isToday =
                    new Date().getDate() === day &&
                    new Date().getMonth() === month &&
                    new Date().getFullYear() === year;

                  return (
                    <button
                      type="button"
                      key={`day-${day}`}
                      onClick={() => handleSelectDay(day)}
                      className={`py-1.5 rounded transition cursor-pointer font-medium ${
                        isSelected
                          ? "bg-purple-600 text-white font-bold"
                          : isToday
                          ? "bg-zinc-100 dark:bg-zinc-900 text-purple-600 dark:text-purple-400 font-bold"
                          : "text-zinc-800 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-950 dark:hover:text-white"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Render Month Selector Grid */}
          {viewMode === "months" && (
            <div className="grid grid-cols-3 gap-2 py-2">
              {monthNames.map((name, idx) => {
                const isCurrent = idx === month;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setCurrentMonth(new Date(year, idx, 1));
                      setViewMode("days");
                    }}
                    className={`py-2 text-xs rounded transition font-medium cursor-pointer ${
                      isCurrent
                        ? "bg-purple-600 text-white font-bold"
                        : "text-zinc-800 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-950 dark:hover:text-white"
                    }`}
                  >
                    {name.substring(0, 3)}
                  </button>
                );
              })}
            </div>
          )}

          {/* Render Year Selector Grid */}
          {viewMode === "years" && (
            <div className="grid grid-cols-4 gap-2 py-2">
              {Array.from({ length: 16 }, (_, i) => baseYear - 8 + i).map((yr) => {
                const isCurrent = yr === year;
                return (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => {
                      setCurrentMonth(new Date(yr, month, 1));
                      setViewMode("days");
                    }}
                    className={`py-2 text-xs rounded transition font-medium cursor-pointer ${
                      isCurrent
                        ? "bg-purple-600 text-white font-bold"
                        : "text-zinc-800 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-950 dark:hover:text-white"
                    }`}
                  >
                    {yr}
                  </button>
                );
              })}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
