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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      export_jobs: {
        Row: {
          created_at: string
          file_url: string | null
          id: string
          params: Json | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          id?: string
          params?: Json | null
          status?: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_url?: string | null
          id?: string
          params?: Json | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      processed_messages: {
        Row: {
          id: string
          processed_at: string
        }
        Insert: {
          id: string
          processed_at?: string
        }
        Update: {
          id?: string
          processed_at?: string
        }
        Relationships: []
      }
      transaction_images: {
        Row: {
          created_at: string
          file_path: string
          id: string
          mime_type: string | null
          transaction_id: string
        }
        Insert: {
          created_at?: string
          file_path: string
          id?: string
          mime_type?: string | null
          transaction_id: string
        }
        Update: {
          created_at?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_images_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number | null
          bank_name: string | null
          category_final: Database["public"]["Enums"]["expense_category"] | null
          category_guess: Database["public"]["Enums"]["expense_category"] | null
          confidence_score: number | null
          created_at: string
          currency: string | null
          date_display: string | null
          drive_file_url: string | null
          drive_sync_status: Database["public"]["Enums"]["sync_status"] | null
          fee: number | null
          id: string
          image_hash: string | null
          line_message_id: string | null
          line_user_id: string | null
          merchant_code: string | null
          merchant_name: string | null
          notes: string | null
          parsed_result: Json | null
          payer_name: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          raw_ocr_text: string | null
          raw_provider_response: Json | null
          receiver_name: string | null
          reference_no: string | null
          sheets_sync_status: Database["public"]["Enums"]["sync_status"] | null
          source: string | null
          source_image_url: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          time_display: string | null
          transaction_code: string | null
          transaction_datetime_iso: string | null
          transaction_type:
            | Database["public"]["Enums"]["transaction_type"]
            | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          bank_name?: string | null
          category_final?:
            | Database["public"]["Enums"]["expense_category"]
            | null
          category_guess?:
            | Database["public"]["Enums"]["expense_category"]
            | null
          confidence_score?: number | null
          created_at?: string
          currency?: string | null
          date_display?: string | null
          drive_file_url?: string | null
          drive_sync_status?: Database["public"]["Enums"]["sync_status"] | null
          fee?: number | null
          id?: string
          image_hash?: string | null
          line_message_id?: string | null
          line_user_id?: string | null
          merchant_code?: string | null
          merchant_name?: string | null
          notes?: string | null
          parsed_result?: Json | null
          payer_name?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          raw_ocr_text?: string | null
          raw_provider_response?: Json | null
          receiver_name?: string | null
          reference_no?: string | null
          sheets_sync_status?: Database["public"]["Enums"]["sync_status"] | null
          source?: string | null
          source_image_url?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          time_display?: string | null
          transaction_code?: string | null
          transaction_datetime_iso?: string | null
          transaction_type?:
            | Database["public"]["Enums"]["transaction_type"]
            | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          bank_name?: string | null
          category_final?:
            | Database["public"]["Enums"]["expense_category"]
            | null
          category_guess?:
            | Database["public"]["Enums"]["expense_category"]
            | null
          confidence_score?: number | null
          created_at?: string
          currency?: string | null
          date_display?: string | null
          drive_file_url?: string | null
          drive_sync_status?: Database["public"]["Enums"]["sync_status"] | null
          fee?: number | null
          id?: string
          image_hash?: string | null
          line_message_id?: string | null
          line_user_id?: string | null
          merchant_code?: string | null
          merchant_name?: string | null
          notes?: string | null
          parsed_result?: Json | null
          payer_name?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          raw_ocr_text?: string | null
          raw_provider_response?: Json | null
          receiver_name?: string | null
          reference_no?: string | null
          sheets_sync_status?: Database["public"]["Enums"]["sync_status"] | null
          source?: string | null
          source_image_url?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          time_display?: string | null
          transaction_code?: string | null
          transaction_datetime_iso?: string | null
          transaction_type?:
            | Database["public"]["Enums"]["transaction_type"]
            | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          line_user_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          line_user_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          line_user_id?: string | null
          user_id?: string | null
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
      expense_category:
        | "food"
        | "transport"
        | "shopping"
        | "bills"
        | "health"
        | "entertainment"
        | "education"
        | "travel"
        | "home"
        | "family"
        | "transfer"
        | "other"
      payment_status: "success" | "failed" | "pending" | "unknown"
      sync_status: "pending" | "synced" | "failed" | "not_applicable"
      transaction_status:
        | "pending_confirmation"
        | "confirmed"
        | "ignored"
        | "editing"
        | "extraction_failed"
      transaction_type:
        | "transfer"
        | "bill_payment"
        | "merchant_payment"
        | "qr_payment"
        | "other"
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
      expense_category: [
        "food",
        "transport",
        "shopping",
        "bills",
        "health",
        "entertainment",
        "education",
        "travel",
        "home",
        "family",
        "transfer",
        "other",
      ],
      payment_status: ["success", "failed", "pending", "unknown"],
      sync_status: ["pending", "synced", "failed", "not_applicable"],
      transaction_status: [
        "pending_confirmation",
        "confirmed",
        "ignored",
        "editing",
        "extraction_failed",
      ],
      transaction_type: [
        "transfer",
        "bill_payment",
        "merchant_payment",
        "qr_payment",
        "other",
      ],
    },
  },
} as const
