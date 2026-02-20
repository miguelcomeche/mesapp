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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      category_settings: {
        Row: {
          auto_marchar_enabled: boolean
          auto_marchar_station: string | null
          category_name: string
          created_at: string
          id: string
          restaurant_id: string
        }
        Insert: {
          auto_marchar_enabled?: boolean
          auto_marchar_station?: string | null
          category_name: string
          created_at?: string
          id?: string
          restaurant_id: string
        }
        Update: {
          auto_marchar_enabled?: boolean
          auto_marchar_station?: string | null
          category_name?: string
          created_at?: string
          id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_tickets: {
        Row: {
          course: Database["public"]["Enums"]["order_course"] | null
          created_at: string
          created_by: string | null
          id: string
          restaurant_id: string
          session_id: string
          station: Database["public"]["Enums"]["order_station"]
          status: Database["public"]["Enums"]["order_item_status"]
        }
        Insert: {
          course?: Database["public"]["Enums"]["order_course"] | null
          created_at?: string
          created_by?: string | null
          id?: string
          restaurant_id: string
          session_id: string
          station: Database["public"]["Enums"]["order_station"]
          status?: Database["public"]["Enums"]["order_item_status"]
        }
        Update: {
          course?: Database["public"]["Enums"]["order_course"] | null
          created_at?: string
          created_by?: string | null
          id?: string
          restaurant_id?: string
          session_id?: string
          station?: Database["public"]["Enums"]["order_station"]
          status?: Database["public"]["Enums"]["order_item_status"]
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_tickets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          available: boolean
          category: string
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          name: string
          price: number
          restaurant_id: string
          subcategory: string | null
        }
        Insert: {
          available?: boolean
          category: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          name: string
          price: number
          restaurant_id: string
          subcategory?: string | null
        }
        Update: {
          available?: boolean
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          restaurant_id?: string
          subcategory?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_groups: {
        Row: {
          applicable_categories: string[]
          created_at: string
          display_order: number | null
          id: string
          name: string
          restaurant_id: string
        }
        Insert: {
          applicable_categories?: string[]
          created_at?: string
          display_order?: number | null
          id?: string
          name: string
          restaurant_id: string
        }
        Update: {
          applicable_categories?: string[]
          created_at?: string
          display_order?: number | null
          id?: string
          name?: string
          restaurant_id?: string
        }
        Relationships: []
      }
      modifiers: {
        Row: {
          available: boolean
          created_at: string
          display_order: number | null
          id: string
          modifier_group_id: string
          name: string
          price_adjustment: number
        }
        Insert: {
          available?: boolean
          created_at?: string
          display_order?: number | null
          id?: string
          modifier_group_id: string
          name: string
          price_adjustment?: number
        }
        Update: {
          available?: boolean
          created_at?: string
          display_order?: number | null
          id?: string
          modifier_group_id?: string
          name?: string
          price_adjustment?: number
        }
        Relationships: [
          {
            foreignKeyName: "modifiers_modifier_group_id_fkey"
            columns: ["modifier_group_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_modifiers: {
        Row: {
          created_at: string
          id: string
          modifier_group: string
          modifier_id: string
          name: string
          order_item_id: string
          price: number
        }
        Insert: {
          created_at?: string
          id?: string
          modifier_group: string
          modifier_id: string
          name: string
          order_item_id: string
          price?: number
        }
        Update: {
          created_at?: string
          id?: string
          modifier_group?: string
          modifier_id?: string
          name?: string
          order_item_id?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_modifiers_modifier_id_fkey"
            columns: ["modifier_id"]
            isOneToOne: false
            referencedRelation: "modifiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_modifiers_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          base_unit_price: number
          course: Database["public"]["Enums"]["order_course"]
          created_at: string
          id: string
          menu_item_id: string
          modifiers: string[] | null
          notes: string | null
          order_id: string
          quantity: number
          sent_at: string | null
          station: Database["public"]["Enums"]["order_station"]
          status: Database["public"]["Enums"]["order_item_status"]
          unit_price: number
        }
        Insert: {
          base_unit_price?: number
          course?: Database["public"]["Enums"]["order_course"]
          created_at?: string
          id?: string
          menu_item_id: string
          modifiers?: string[] | null
          notes?: string | null
          order_id: string
          quantity?: number
          sent_at?: string | null
          station?: Database["public"]["Enums"]["order_station"]
          status?: Database["public"]["Enums"]["order_item_status"]
          unit_price: number
        }
        Update: {
          base_unit_price?: number
          course?: Database["public"]["Enums"]["order_course"]
          created_at?: string
          id?: string
          menu_item_id?: string
          modifiers?: string[] | null
          notes?: string | null
          order_id?: string
          quantity?: number
          sent_at?: string | null
          station?: Database["public"]["Enums"]["order_station"]
          status?: Database["public"]["Enums"]["order_item_status"]
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          prepared_at: string | null
          served_at: string | null
          session_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          prepared_at?: string | null
          served_at?: string | null
          session_id: string
          status?: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          prepared_at?: string | null
          served_at?: string | null
          session_id?: string
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "orders_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          processed_at: string
          session_id: string
          tip: number | null
        }
        Insert: {
          amount: number
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          processed_at?: string
          session_id: string
          tip?: number | null
        }
        Update: {
          amount?: number
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          processed_at?: string
          session_id?: string
          tip?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string
          restaurant_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          name: string
          restaurant_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          restaurant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          created_at: string
          external_id: string | null
          external_source: string | null
          guest_email: string | null
          guest_name: string
          guest_phone: string | null
          id: string
          notes: string | null
          party_size: number
          restaurant_id: string
          scheduled_time: string
          source: Database["public"]["Enums"]["reservation_source"]
          status: Database["public"]["Enums"]["reservation_status"]
          table_id: string | null
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          external_source?: string | null
          guest_email?: string | null
          guest_name: string
          guest_phone?: string | null
          id?: string
          notes?: string | null
          party_size?: number
          restaurant_id: string
          scheduled_time: string
          source?: Database["public"]["Enums"]["reservation_source"]
          status?: Database["public"]["Enums"]["reservation_status"]
          table_id?: string | null
        }
        Update: {
          created_at?: string
          external_id?: string | null
          external_source?: string | null
          guest_email?: string | null
          guest_name?: string
          guest_phone?: string | null
          id?: string
          notes?: string | null
          party_size?: number
          restaurant_id?: string
          scheduled_time?: string
          source?: Database["public"]["Enums"]["reservation_source"]
          status?: Database["public"]["Enums"]["reservation_status"]
          table_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          created_at: string
          currency: string
          id: string
          name: string
          phone: string | null
          timezone: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          currency?: string
          id?: string
          name: string
          phone?: string | null
          timezone?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          currency?: string
          id?: string
          name?: string
          phone?: string | null
          timezone?: string
        }
        Relationships: []
      }
      table_sessions: {
        Row: {
          closed_at: string | null
          guest_count: number
          id: string
          reservation_id: string | null
          restaurant_id: string
          started_at: string
          status: Database["public"]["Enums"]["session_status"]
          table_id: string
          total_amount: number
          waiter_id: string | null
        }
        Insert: {
          closed_at?: string | null
          guest_count?: number
          id?: string
          reservation_id?: string | null
          restaurant_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          table_id: string
          total_amount?: number
          waiter_id?: string | null
        }
        Update: {
          closed_at?: string | null
          guest_count?: number
          id?: string
          reservation_id?: string | null
          restaurant_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          table_id?: string
          total_amount?: number
          waiter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "table_sessions_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          capacity: number
          created_at: string
          id: string
          number: string
          position_x: number | null
          position_y: number | null
          restaurant_id: string
          section: string
          status: Database["public"]["Enums"]["table_status"]
        }
        Insert: {
          capacity?: number
          created_at?: string
          id?: string
          number: string
          position_x?: number | null
          position_y?: number | null
          restaurant_id: string
          section?: string
          status?: Database["public"]["Enums"]["table_status"]
        }
        Update: {
          capacity?: number
          created_at?: string
          id?: string
          number?: string
          position_x?: number | null
          position_y?: number | null
          restaurant_id?: string
          section?: string
          status?: Database["public"]["Enums"]["table_status"]
        }
        Relationships: [
          {
            foreignKeyName: "tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_items: {
        Row: {
          created_at: string
          id: string
          order_item_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_item_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_item_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_items_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "kitchen_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_restaurant_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      order_course: "unassigned" | "primeros" | "segundos" | "postres"
      order_item_status:
        | "pending"
        | "sent"
        | "preparing"
        | "ready"
        | "served"
        | "cancelled"
      order_station: "kitchen" | "bar"
      order_status: "pending" | "preparing" | "ready" | "served" | "cancelled"
      payment_method: "cash" | "card" | "split"
      reservation_source:
        | "manual"
        | "phone"
        | "walkin"
        | "covermanager"
        | "restoo"
      reservation_status:
        | "pending"
        | "pending_confirmation"
        | "confirmed"
        | "seated"
        | "completed"
        | "cancelled"
        | "no_show"
      session_status: "active" | "billing" | "closed"
      table_status: "available" | "occupied" | "reserved" | "needs_attention"
      user_role: "admin" | "manager" | "waiter"
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
      order_course: ["unassigned", "primeros", "segundos", "postres"],
      order_item_status: [
        "pending",
        "sent",
        "preparing",
        "ready",
        "served",
        "cancelled",
      ],
      order_station: ["kitchen", "bar"],
      order_status: ["pending", "preparing", "ready", "served", "cancelled"],
      payment_method: ["cash", "card", "split"],
      reservation_source: [
        "manual",
        "phone",
        "walkin",
        "covermanager",
        "restoo",
      ],
      reservation_status: [
        "pending",
        "pending_confirmation",
        "confirmed",
        "seated",
        "completed",
        "cancelled",
        "no_show",
      ],
      session_status: ["active", "billing", "closed"],
      table_status: ["available", "occupied", "reserved", "needs_attention"],
      user_role: ["admin", "manager", "waiter"],
    },
  },
} as const
