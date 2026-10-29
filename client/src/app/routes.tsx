import { createBrowserRouter, Navigate } from 'react-router'
import { AppShell } from '../components/layout/AppShell'
import { AcademicPage } from '../features/academic/AcademicPage'
import { AuthPage } from '../features/auth/AuthPage'
import { ResetPasswordPage } from '../features/auth/PasswordReset'
import { RequireAuth } from '../features/auth/RequireAuth'
import { CalendarPage } from '../features/calendar/CalendarPage'
import { TodayPage } from '../features/dashboard/TodayPage'
import { LandingPage } from '../features/landing/LandingPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { TasksPage } from '../features/tasks/TasksPage'

export const router = createBrowserRouter([
  { path: '/welcome', element: <LandingPage /> },
  { path: '/sign-in', element: <AuthPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
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
      { path: 'academic', element: <AcademicPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
