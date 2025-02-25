import React from "react";
import Calendar from "../../components/calendar/Calendar";
import { CalendarProvider } from "../../components/calendar/CalendarContext";

export default function CalendarPage() {
  return (
    <div className="p-3 h-[calc(100vh-64px)] flex flex-col w-full">
      <div className="w-full">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <p className="text-gray-600 dark:text-gray-300 text-sm mb-2">
          Use this calendar to schedule and manage your content posts. View by day, week, month, or year.
        </p>
      </div>
      
      <div className="flex-1 h-[calc(100vh-120px)] w-full">
        <CalendarProvider>
          <Calendar />
        </CalendarProvider>
      </div>
    </div>
  );
} 