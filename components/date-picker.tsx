"use client";

import React, { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";

interface DatePickerProps {
  value: string | null;
  onChange: (dateStr: string | null) => void;
}

export function DatePicker({ value, onChange }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current date value
  const selectedDate = value ? new Date(value) : null;

  // Toggle calendar popup
  const toggleOpen = () => setIsOpen(!isOpen);

  // Close calendar if clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Format date display (e.g. "Jun 3, 2026")
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Calendar logic helpers
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    // Generate ISO string format YYYY-MM-DD
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

  // Generate days array
  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null); // padding for empty days
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
        type="button"
        onClick={toggleOpen}
        className="w-full flex items-center justify-between gap-2 text-xs text-left px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 transition focus:ring-1 focus:ring-purple-500 outline-none"
      >
        <span className="flex items-center gap-2 truncate">
          <CalendarIcon className="h-3.5 w-3.5 text-zinc-400" />
          {selectedDate ? formatDate(selectedDate) : <span className="text-zinc-500">Pick a date</span>}
        </span>
        {value && (
          <span
            onClick={handleClear}
            className="p-0.5 rounded-full hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition"
          >
            <X className="h-3 w-3" />
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 z-50 p-4 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl w-[280px] animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-white">
              {monthNames[month]} {year}
            </span>
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 rounded hover:bg-zinc-900 text-zinc-400 hover:text-white transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 rounded hover:bg-zinc-900 text-zinc-400 hover:text-white transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-zinc-500 uppercase mb-2">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          {/* Days Grid */}
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
                  className={`py-1.5 rounded transition ${
                    isSelected
                      ? "bg-purple-600 text-white font-bold"
                      : isToday
                      ? "bg-zinc-900 text-purple-400 font-semibold"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
