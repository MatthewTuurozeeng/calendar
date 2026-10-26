import { EmptyState } from '../../components/ui/EmptyState'

export function TasksPage() {
  return (
    <EmptyState
      title="No tasks yet"
      description="Tasks due today, upcoming, overdue and completed will be listed here."
    />
  )
}
