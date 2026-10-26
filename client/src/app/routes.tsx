import { createBrowserRouter, Navigate } from 'react-router'
import { AppShell } from '../components/layout/AppShell'
import { AuthPage } from '../features/auth/AuthPage'
import { RequireAuth } from '../features/auth/RequireAuth'
import { CalendarPage } from '../features/calendar/CalendarPage'
import { TodayPage } from '../features/dashboard/TodayPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { TasksPage } from '../features/tasks/TasksPage'

export const router = createBrowserRouter([
  { path: '/sign-in', element: <AuthPage /> },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <TodayPage /> },
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
