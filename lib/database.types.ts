export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          credits: number
          created_at: string
        }
        Insert: {
          id: string
          credits?: number
          created_at?: string
        }
        Update: {
          id?: string
          credits?: number
          created_at?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          id: string
          user_id: string
          lalal_job_id: string
          lalal_vocal_task_id: string | null
          lalal_instrumental_task_id: string | null
          status: string
          original_filename: string
          vocal_url: string | null
          instrumental_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          lalal_job_id: string
          lalal_vocal_task_id?: string | null
          lalal_instrumental_task_id?: string | null
          status: string
          original_filename: string
          vocal_url?: string | null
          instrumental_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          lalal_job_id?: string
          lalal_vocal_task_id?: string | null
          lalal_instrumental_task_id?: string | null
          status?: string
          original_filename?: string
          vocal_url?: string | null
          instrumental_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      credit_purchases: {
        Row: {
          id: string
          user_id: string
          stripe_session_id: string
          credits_purchased: number
          amount_gbp: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          stripe_session_id: string
          credits_purchased: number
          amount_gbp: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          stripe_session_id?: string
          credits_purchased?: number
          amount_gbp?: number
          created_at?: string
        }
        Relationships: []
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
  }
}
