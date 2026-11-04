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
  public: {
    Tables: {
      account_requests: {
        Row: {
          company: string
          contact_name: string
          created_at: string
          email: string
          id: string
          message: string | null
          phone: string | null
          siret: string | null
        }
        Insert: {
          company: string
          contact_name: string
          created_at?: string
          email: string
          id?: string
          message?: string | null
          phone?: string | null
          siret?: string | null
        }
        Update: {
          company?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          phone?: string | null
          siret?: string | null
        }
        Relationships: []
      }
      accounts: {
        Row: {
          account_discount: number
          approval_threshold: number
          credit_limit: number
          current_outstanding: number
          id: string
          name: string
        }
        Insert: {
          account_discount?: number
          approval_threshold?: number
          credit_limit?: number
          current_outstanding?: number
          id?: string
          name: string
        }
        Update: {
          account_discount?: number
          approval_threshold?: number
          credit_limit?: number
          current_outstanding?: number
          id?: string
          name?: string
        }
        Relationships: []
      }
      contract_prices: {
        Row: {
          account_id: string
          end_date: string
          id: string
          price: number
          product_id: string
        }
        Insert: {
          account_id: string
          end_date: string
          id?: string
          price: number
          product_id: string
        }
        Update: {
          account_id?: string
          end_date?: string
          id?: string
          price?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_prices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          id: string
          message: string
          object_id: string | null
          object_type: string
          type: Database["public"]["Enums"]["event_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          object_id?: string | null
          object_type: string
          type: Database["public"]["Enums"]["event_type"]
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          object_id?: string | null
          object_type?: string
          type?: Database["public"]["Enums"]["event_type"]
        }
        Relationships: []
      }
      order_lines: {
        Row: {
          id: string
          order_id: string
          price_origin: Database["public"]["Enums"]["price_origin"]
          product_id: string
          quantity: number
          unit_price_applied: number
        }
        Insert: {
          id?: string
          order_id: string
          price_origin: Database["public"]["Enums"]["price_origin"]
          product_id: string
          quantity: number
          unit_price_applied: number
        }
        Update: {
          id?: string
          order_id?: string
          price_origin?: Database["public"]["Enums"]["price_origin"]
          product_id?: string
          quantity?: number
          unit_price_applied?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          account_id: string
          created_at: string
          created_by: string
          erp_reference: string | null
          id: string
          partial_delivery_allowed: boolean
          processing_fee: number
          shipping_fee: number
          status: Database["public"]["Enums"]["order_status"]
          total_ht: number
          tracking_number: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by: string
          erp_reference?: string | null
          id?: string
          partial_delivery_allowed?: boolean
          processing_fee?: number
          shipping_fee?: number
          status?: Database["public"]["Enums"]["order_status"]
          total_ht?: number
          tracking_number?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string
          erp_reference?: string | null
          id?: string
          partial_delivery_allowed?: boolean
          processing_fee?: number
          shipping_fee?: number
          status?: Database["public"]["Enums"]["order_status"]
          total_ht?: number
          tracking_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          catalog_price: number
          family: string
          id: string
          image_url: string | null
          name: string
          pack_size: number
          sku: string
          status: Database["public"]["Enums"]["product_status"]
          technical_attributes: Json
        }
        Insert: {
          catalog_price: number
          family: string
          id?: string
          image_url?: string | null
          name: string
          pack_size?: number
          sku: string
          status?: Database["public"]["Enums"]["product_status"]
          technical_attributes?: Json
        }
        Update: {
          catalog_price?: number
          family?: string
          id?: string
          image_url?: string | null
          name?: string
          pack_size?: number
          sku?: string
          status?: Database["public"]["Enums"]["product_status"]
          technical_attributes?: Json
        }
        Relationships: []
      }
      quote_lines: {
        Row: {
          product_id: string
          quantity: number
          quote_id: string
          unit_price: number | null
        }
        Insert: {
          product_id: string
          quantity: number
          quote_id: string
          unit_price?: number | null
        }
        Update: {
          product_id?: string
          quantity?: number
          quote_id?: string
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          account_id: string
          created_at: string
          id: string
          requested_by: string
          status: Database["public"]["Enums"]["quote_status"]
          total_ht: number | null
          valid_until: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          requested_by: string
          status?: Database["public"]["Enums"]["quote_status"]
          total_ht?: number | null
          valid_until?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["quote_status"]
          total_ht?: number | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stock: {
        Row: {
          product_id: string
          quantity: number
          restock_delay_days: number
        }
        Insert: {
          product_id: string
          quantity?: number
          restock_delay_days?: number
        }
        Update: {
          product_id?: string
          quantity?: number
          restock_delay_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      tier_prices: {
        Row: {
          discount_percent: number
          id: string
          min_quantity: number
          product_id: string
        }
        Insert: {
          discount_percent: number
          id?: string
          min_quantity: number
          product_id: string
        }
        Update: {
          discount_percent?: number
          id?: string
          min_quantity?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tier_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          account_id: string | null
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          account_id?: string | null
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          account_id?: string | null
          email?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "users_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_order: {
        Args: { _approve: boolean; _order: string }
        Returns: undefined
      }
      compute_price: {
        Args: { _account: string; _product: string; _qty: number }
        Returns: {
          origin: Database["public"]["Enums"]["price_origin"]
          unit_price: number
        }[]
      }
      current_account_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_portal_user: { Args: never; Returns: boolean }
      my_price: {
        Args: { _product: string; _qty: number }
        Returns: {
          origin: Database["public"]["Enums"]["price_origin"]
          unit_price: number
        }[]
      }
      place_order: {
        Args: { _lines: Json; _partial: boolean }
        Returns: string
      }
    }
    Enums: {
      app_role: "buyer" | "approver" | "admin"
      event_type: "erp_attempt" | "erp_error" | "alert" | "status_change"
      order_status:
        | "draft"
        | "pending_approval"
        | "blocked_credit"
        | "validated"
        | "sent_to_erp"
        | "in_preparation"
        | "shipped"
        | "delivered"
        | "cancelled"
      price_origin: "contract" | "tier" | "account_discount" | "catalog"
      product_status: "active" | "discontinued" | "quote_only"
      quote_status: "requested" | "priced" | "accepted" | "expired"
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
  public: {
    Enums: {
      app_role: ["buyer", "approver", "admin"],
      event_type: ["erp_attempt", "erp_error", "alert", "status_change"],
      order_status: [
        "draft",
        "pending_approval",
        "blocked_credit",
        "validated",
        "sent_to_erp",
        "in_preparation",
        "shipped",
        "delivered",
        "cancelled",
      ],
      price_origin: ["contract", "tier", "account_discount", "catalog"],
      product_status: ["active", "discontinued", "quote_only"],
      quote_status: ["requested", "priced", "accepted", "expired"],
    },
  },
} as const
