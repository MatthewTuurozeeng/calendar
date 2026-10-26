export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      categories: {
        Row: {
          archived_at: string | null
          color: string
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          color: string
          created_at?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          archived_at: string | null
          code: string
          color: string | null
          created_at: string
          id: string
          lecturer: string | null
          semester_id: string
          title: string
          updated_at: string
          user_id: string
          venue: string | null
        }
        Insert: {
          archived_at?: string | null
          code: string
          color?: string | null
          created_at?: string
          id?: string
          lecturer?: string | null
          semester_id: string
          title: string
          updated_at?: string
          user_id: string
          venue?: string | null
        }
        Update: {
          archived_at?: string | null
          code?: string
          color?: string | null
          created_at?: string
          id?: string
          lecturer?: string | null
          semester_id?: string
          title?: string
          updated_at?: string
          user_id?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_user_id_semester_id_fkey"
            columns: ["user_id", "semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      daily_notes: {
        Row: {
          created_at: string
          intention: string | null
          note: string | null
          note_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          intention?: string | null
          note?: string | null
          note_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          intention?: string | null
          note?: string | null
          note_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      event_exceptions: {
        Row: {
          created_at: string
          event_id: string
          id: string
          is_cancelled: boolean
          new_description: string | null
          new_end_at: string | null
          new_location: string | null
          new_start_at: string | null
          new_title: string | null
          original_date: string | null
          original_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          is_cancelled?: boolean
          new_description?: string | null
          new_end_at?: string | null
          new_location?: string | null
          new_start_at?: string | null
          new_title?: string | null
          original_date?: string | null
          original_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          is_cancelled?: boolean
          new_description?: string | null
          new_end_at?: string | null
          new_location?: string | null
          new_start_at?: string | null
          new_title?: string | null
          original_date?: string | null
          original_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_exceptions_user_id_event_id_fkey"
            columns: ["user_id", "event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      events: {
        Row: {
          all_day: boolean
          category_id: string | null
          course_id: string | null
          created_at: string
          description: string | null
          end_at: string | null
          end_date: string | null
          id: string
          kind: string
          location: string | null
          reminder_offsets: number[]
          rrule: string | null
          series_until: string | null
          start_at: string | null
          start_date: string | null
          task_id: string | null
          timezone: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          category_id?: string | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          end_date?: string | null
          id?: string
          kind?: string
          location?: string | null
          reminder_offsets?: number[]
          rrule?: string | null
          series_until?: string | null
          start_at?: string | null
          start_date?: string | null
          task_id?: string | null
          timezone: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          category_id?: string | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          end_date?: string | null
          id?: string
          kind?: string
          location?: string | null
          reminder_offsets?: number[]
          rrule?: string | null
          series_until?: string | null
          start_at?: string | null
          start_date?: string | null
          task_id?: string | null
          timezone?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_user_id_category_id_fkey"
            columns: ["user_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "events_user_id_course_id_fkey"
            columns: ["user_id", "course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "events_user_id_task_id_fkey"
            columns: ["user_id", "task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          dashboard_prefs: Json
          display_name: string | null
          enabled_modules: string[]
          id: string
          notification_prefs: Json
          timezone: string
          updated_at: string
          week_starts_on: number
        }
        Insert: {
          created_at?: string
          dashboard_prefs?: Json
          display_name?: string | null
          enabled_modules?: string[]
          id: string
          notification_prefs?: Json
          timezone: string
          updated_at?: string
          week_starts_on?: number
        }
        Update: {
          created_at?: string
          dashboard_prefs?: Json
          display_name?: string | null
          enabled_modules?: string[]
          id?: string
          notification_prefs?: Json
          timezone?: string
          updated_at?: string
          week_starts_on?: number
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          revoked_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          revoked_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          revoked_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          attempt_count: number
          created_at: string
          event_id: string | null
          id: string
          idempotency_key: string
          last_error: string | null
          locked_at: string | null
          occurrence_start: string | null
          offset_minutes: number
          remind_at: string
          sent_at: string | null
          status: string
          task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          event_id?: string | null
          id?: string
          idempotency_key: string
          last_error?: string | null
          locked_at?: string | null
          occurrence_start?: string | null
          offset_minutes: number
          remind_at: string
          sent_at?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          event_id?: string | null
          id?: string
          idempotency_key?: string
          last_error?: string | null
          locked_at?: string | null
          occurrence_start?: string | null
          offset_minutes?: number
          remind_at?: string
          sent_at?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_user_id_event_id_fkey"
            columns: ["user_id", "event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "reminders_user_id_task_id_fkey"
            columns: ["user_id", "task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      semesters: {
        Row: {
          archived_at: string | null
          created_at: string
          end_date: string
          id: string
          name: string
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          end_date: string
          id?: string
          name: string
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_subtasks: {
        Row: {
          created_at: string
          id: string
          is_completed: boolean
          position: number
          task_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_completed?: boolean
          position?: number
          task_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_completed?: boolean
          position?: number
          task_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_subtasks_user_id_task_id_fkey"
            columns: ["user_id", "task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      tasks: {
        Row: {
          category_id: string | null
          completed_at: string | null
          course_id: string | null
          created_at: string
          description: string | null
          due_at: string | null
          due_date: string | null
          estimated_minutes: number | null
          id: string
          position: number
          priority: string
          reminder_offsets: number[]
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          due_date?: string | null
          estimated_minutes?: number | null
          id?: string
          position?: number
          priority?: string
          reminder_offsets?: number[]
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          due_date?: string | null
          estimated_minutes?: number | null
          id?: string
          position?: number
          priority?: string
          reminder_offsets?: number[]
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_user_id_category_id_fkey"
            columns: ["user_id", "category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "tasks_user_id_course_id_fkey"
            columns: ["user_id", "course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
