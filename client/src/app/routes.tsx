import { createBrowserRouter, Navigate } from 'react-router'
import { AppShell } from '../components/layout/AppShell'
import { CalendarPage } from '../features/calendar/CalendarPage'
import { TodayPage } from '../features/dashboard/TodayPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { TasksPage } from '../features/tasks/TasksPage'

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <TodayPage /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
