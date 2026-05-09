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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      artifacts: {
        Row: {
          created_at: string
          id: string
          job_id: string
          kind: string
          metadata: Json
          name: string
          run_id: string
          uri: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          kind: string
          metadata?: Json
          name: string
          run_id: string
          uri: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          kind?: string
          metadata?: Json
          name?: string
          run_id?: string
          uri?: string
        }
        Relationships: [
          {
            foreignKeyName: "artifacts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artifacts_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          agent: string
          base_branch: string
          branch_name: string
          created_at: string
          id: string
          idempotency_key: string | null
          metadata: Json
          mr_body: string | null
          mr_title: string | null
          prompt: string
          repo: string
          source: string
          spec: Json
          task_id: string
          updated_at: string
        }
        Insert: {
          agent: string
          base_branch?: string
          branch_name: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          mr_body?: string | null
          mr_title?: string | null
          prompt: string
          repo: string
          source: string
          spec: Json
          task_id: string
          updated_at?: string
        }
        Update: {
          agent?: string
          base_branch?: string
          branch_name?: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          mr_body?: string | null
          mr_title?: string | null
          prompt?: string
          repo?: string
          source?: string
          spec?: Json
          task_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      run_events: {
        Row: {
          created_at: string
          data: Json
          id: string
          job_id: string
          run_id: string
          severity: Database["public"]["Enums"]["run_event_severity"]
          type: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          job_id: string
          run_id: string
          severity?: Database["public"]["Enums"]["run_event_severity"]
          type: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          job_id?: string
          run_id?: string
          severity?: Database["public"]["Enums"]["run_event_severity"]
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      runner_sessions: {
        Row: {
          active_run_count: number
          capabilities: Json
          created_at: string
          expires_at: string
          id: string
          last_heartbeat_at: string
          max_concurrency: number
          revoked_at: string | null
          runner_name: string
          session_token_hash: string
          updated_at: string
        }
        Insert: {
          active_run_count?: number
          capabilities?: Json
          created_at?: string
          expires_at: string
          id?: string
          last_heartbeat_at?: string
          max_concurrency?: number
          revoked_at?: string | null
          runner_name: string
          session_token_hash: string
          updated_at?: string
        }
        Update: {
          active_run_count?: number
          capabilities?: Json
          created_at?: string
          expires_at?: string
          id?: string
          last_heartbeat_at?: string
          max_concurrency?: number
          revoked_at?: string | null
          runner_name?: string
          session_token_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      runs: {
        Row: {
          assigned_runner_session_id: string | null
          attempt: number
          created_at: string
          failure_reason: string | null
          finished_at: string | null
          id: string
          job_id: string
          result: Json | null
          started_at: string | null
          state: Database["public"]["Enums"]["run_state"]
          timeout_at: string | null
          updated_at: string
        }
        Insert: {
          assigned_runner_session_id?: string | null
          attempt?: number
          created_at?: string
          failure_reason?: string | null
          finished_at?: string | null
          id?: string
          job_id: string
          result?: Json | null
          started_at?: string | null
          state?: Database["public"]["Enums"]["run_state"]
          timeout_at?: string | null
          updated_at?: string
        }
        Update: {
          assigned_runner_session_id?: string | null
          attempt?: number
          created_at?: string
          failure_reason?: string | null
          finished_at?: string | null
          id?: string
          job_id?: string
          result?: Json | null
          started_at?: string | null
          state?: Database["public"]["Enums"]["run_state"]
          timeout_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "runs_assigned_runner_session_fk"
            columns: ["assigned_runner_session_id"]
            isOneToOne: false
            referencedRelation: "runner_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
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
      run_event_severity: "debug" | "info" | "warn" | "error"
      run_state:
        | "queued"
        | "dispatching"
        | "assigned"
        | "starting"
        | "running"
        | "succeeded"
        | "failed"
        | "canceled"
        | "timed_out"
        | "needs_human_review"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      run_event_severity: ["debug", "info", "warn", "error"],
      run_state: [
        "queued",
        "dispatching",
        "assigned",
        "starting",
        "running",
        "succeeded",
        "failed",
        "canceled",
        "timed_out",
        "needs_human_review",
      ],
    },
  },
} as const
