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
      floor_plan_elements: {
        Row: {
          color: string | null
          created_at: string
          height: number
          id: string
          label: string | null
          restaurant_id: string
          rotation: number
          type: Database["public"]["Enums"]["floor_element_type"]
          updated_at: string
          width: number
          x: number
          y: number
          zone: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          height?: number
          id?: string
          label?: string | null
          restaurant_id: string
          rotation?: number
          type: Database["public"]["Enums"]["floor_element_type"]
          updated_at?: string
          width?: number
          x?: number
          y?: number
          zone?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          height?: number
          id?: string
          label?: string | null
          restaurant_id?: string
          rotation?: number
          type?: Database["public"]["Enums"]["floor_element_type"]
          updated_at?: string
          width?: number
          x?: number
          y?: number
          zone?: string
        }
        Relationships: []
      }
      kitchen_tickets: {
        Row: {
          course: Database["public"]["Enums"]["order_course"] | null
          created_at: string
          created_by: string | null
          fired_by_waiter_id: string | null
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
          fired_by_waiter_id?: string | null
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
          fired_by_waiter_id?: string | null
          id?: string
          restaurant_id?: string
          session_id?: string
          station?: Database["public"]["Enums"]["order_station"]
          status?: Database["public"]["Enums"]["order_item_status"]
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_tickets_fired_by_waiter_id_fkey"
            columns: ["fired_by_waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
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
          added_by_waiter_id: string | null
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
          added_by_waiter_id?: string | null
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
          added_by_waiter_id?: string | null
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
            foreignKeyName: "order_items_added_by_waiter_id_fkey"
            columns: ["added_by_waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
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
          paid_by_waiter_id: string | null
          processed_at: string
          session_id: string
          tip: number | null
        }
        Insert: {
          amount: number
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          paid_by_waiter_id?: string | null
          processed_at?: string
          session_id: string
          tip?: number | null
        }
        Update: {
          amount?: number
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          paid_by_waiter_id?: string | null
          processed_at?: string
          session_id?: string
          tip?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_paid_by_waiter_id_fkey"
            columns: ["paid_by_waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          allow_demo_restaurants: boolean
          base_domain: string
          created_at: string
          id: number
          logo_url: string | null
          maintenance_mode: boolean
          platform_name: string
          primary_color: string | null
          secondary_color: string | null
          support_email: string | null
          updated_at: string
        }
        Insert: {
          allow_demo_restaurants?: boolean
          base_domain?: string
          created_at?: string
          id?: number
          logo_url?: string | null
          maintenance_mode?: boolean
          platform_name?: string
          primary_color?: string | null
          secondary_color?: string | null
          support_email?: string | null
          updated_at?: string
        }
        Update: {
          allow_demo_restaurants?: boolean
          base_domain?: string
          created_at?: string
          id?: number
          logo_url?: string | null
          maintenance_mode?: boolean
          platform_name?: string
          primary_color?: string | null
          secondary_color?: string | null
          support_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      printers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          ip_address: string | null
          name: string
          port: number | null
          restaurant_id: string
          station: Database["public"]["Enums"]["printer_station"]
          type: Database["public"]["Enums"]["printer_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          ip_address?: string | null
          name: string
          port?: number | null
          restaurant_id: string
          station?: Database["public"]["Enums"]["printer_station"]
          type?: Database["public"]["Enums"]["printer_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          ip_address?: string | null
          name?: string
          port?: number | null
          restaurant_id?: string
          station?: Database["public"]["Enums"]["printer_station"]
          type?: Database["public"]["Enums"]["printer_type"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          last_sign_in_at: string | null
          name: string
          restaurant_id: string | null
          status: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          last_sign_in_at?: string | null
          name: string
          restaurant_id?: string | null
          status?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          last_sign_in_at?: string | null
          name?: string
          restaurant_id?: string | null
          status?: string
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
      restaurant_hours: {
        Row: {
          closed: boolean
          created_at: string
          day_of_week: number
          dinner_close: string | null
          dinner_open: string | null
          id: string
          lunch_close: string | null
          lunch_open: string | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          closed?: boolean
          created_at?: string
          day_of_week: number
          dinner_close?: string | null
          dinner_open?: string | null
          id?: string
          lunch_close?: string | null
          lunch_open?: string | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          closed?: boolean
          created_at?: string
          day_of_week?: number
          dinner_close?: string | null
          dinner_open?: string | null
          id?: string
          lunch_close?: string | null
          lunch_open?: string | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_modules: {
        Row: {
          analytics_enabled: boolean
          created_at: string
          id: string
          kitchen_bar_enabled: boolean
          menu_enabled: boolean
          payments_enabled: boolean
          pos_enabled: boolean
          printing_enabled: boolean
          public_booking_enabled: boolean
          reservations_enabled: boolean
          restaurant_id: string
          tickets_enabled: boolean
          updated_at: string
        }
        Insert: {
          analytics_enabled?: boolean
          created_at?: string
          id?: string
          kitchen_bar_enabled?: boolean
          menu_enabled?: boolean
          payments_enabled?: boolean
          pos_enabled?: boolean
          printing_enabled?: boolean
          public_booking_enabled?: boolean
          reservations_enabled?: boolean
          restaurant_id: string
          tickets_enabled?: boolean
          updated_at?: string
        }
        Update: {
          analytics_enabled?: boolean
          created_at?: string
          id?: string
          kitchen_bar_enabled?: boolean
          menu_enabled?: boolean
          payments_enabled?: boolean
          pos_enabled?: boolean
          printing_enabled?: boolean
          public_booking_enabled?: boolean
          reservations_enabled?: boolean
          restaurant_id?: string
          tickets_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_modules_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_reservation_settings: {
        Row: {
          buffer_minutes: number
          created_at: string
          default_duration_minutes: number
          id: string
          max_lead_days: number
          max_online_party_size: number
          min_lead_minutes: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          buffer_minutes?: number
          created_at?: string
          default_duration_minutes?: number
          id?: string
          max_lead_days?: number
          max_online_party_size?: number
          min_lead_minutes?: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          buffer_minutes?: number
          created_at?: string
          default_duration_minutes?: number
          id?: string
          max_lead_days?: number
          max_online_party_size?: number
          min_lead_minutes?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_special_days: {
        Row: {
          closed: boolean
          created_at: string
          date: string
          dinner_close: string | null
          dinner_open: string | null
          id: string
          lunch_close: string | null
          lunch_open: string | null
          note: string | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          closed?: boolean
          created_at?: string
          date: string
          dinner_close?: string | null
          dinner_open?: string | null
          id?: string
          lunch_close?: string | null
          lunch_open?: string | null
          note?: string | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          closed?: boolean
          created_at?: string
          date?: string
          dinner_close?: string | null
          dinner_open?: string | null
          id?: string
          lunch_close?: string | null
          lunch_open?: string | null
          note?: string | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_users: {
        Row: {
          created_at: string
          restaurant_id: string
          role: Database["public"]["Enums"]["restaurant_role"]
          status: Database["public"]["Enums"]["restaurant_user_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          restaurant_id: string
          role?: Database["public"]["Enums"]["restaurant_role"]
          status?: Database["public"]["Enums"]["restaurant_user_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          restaurant_id?: string
          role?: Database["public"]["Enums"]["restaurant_role"]
          status?: Database["public"]["Enums"]["restaurant_user_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_users_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          currency: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          postal_code: string | null
          primary_color: string | null
          secondary_color: string | null
          slug: string
          status: Database["public"]["Enums"]["restaurant_status"]
          tax_id: string | null
          timezone: string
          type: Database["public"]["Enums"]["restaurant_type"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          postal_code?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          slug: string
          status?: Database["public"]["Enums"]["restaurant_status"]
          tax_id?: string | null
          timezone?: string
          type?: Database["public"]["Enums"]["restaurant_type"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["restaurant_status"]
          tax_id?: string | null
          timezone?: string
          type?: Database["public"]["Enums"]["restaurant_type"]
          updated_at?: string
        }
        Relationships: []
      }
      table_groups: {
        Row: {
          active_session_id: string | null
          created_at: string
          default_capacity: number
          id: string
          max_capacity: number
          min_capacity: number
          name: string
          restaurant_id: string
          updated_at: string
          zone: string | null
        }
        Insert: {
          active_session_id?: string | null
          created_at?: string
          default_capacity?: number
          id?: string
          max_capacity?: number
          min_capacity?: number
          name?: string
          restaurant_id: string
          updated_at?: string
          zone?: string | null
        }
        Update: {
          active_session_id?: string | null
          created_at?: string
          default_capacity?: number
          id?: string
          max_capacity?: number
          min_capacity?: number
          name?: string
          restaurant_id?: string
          updated_at?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "table_groups_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      table_sessions: {
        Row: {
          closed_at: string | null
          closed_by_waiter_id: string | null
          group_id: string | null
          guest_count: number
          id: string
          opened_by_waiter_id: string | null
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
          closed_by_waiter_id?: string | null
          group_id?: string | null
          guest_count?: number
          id?: string
          opened_by_waiter_id?: string | null
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
          closed_by_waiter_id?: string | null
          group_id?: string | null
          guest_count?: number
          id?: string
          opened_by_waiter_id?: string | null
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
            foreignKeyName: "table_sessions_closed_by_waiter_id_fkey"
            columns: ["closed_by_waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "table_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_sessions_opened_by_waiter_id_fkey"
            columns: ["opened_by_waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
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
          active: boolean
          capacity: number
          created_at: string
          group_id: string | null
          height: number
          id: string
          max_capacity: number
          min_capacity: number
          number: string
          position_x: number | null
          position_y: number | null
          restaurant_id: string
          rotation: number
          section: string
          status: Database["public"]["Enums"]["table_status"]
          width: number
        }
        Insert: {
          active?: boolean
          capacity?: number
          created_at?: string
          group_id?: string | null
          height?: number
          id?: string
          max_capacity?: number
          min_capacity?: number
          number: string
          position_x?: number | null
          position_y?: number | null
          restaurant_id: string
          rotation?: number
          section?: string
          status?: Database["public"]["Enums"]["table_status"]
          width?: number
        }
        Update: {
          active?: boolean
          capacity?: number
          created_at?: string
          group_id?: string | null
          height?: number
          id?: string
          max_capacity?: number
          min_capacity?: number
          number?: string
          position_x?: number | null
          position_y?: number | null
          restaurant_id?: string
          rotation?: number
          section?: string
          status?: Database["public"]["Enums"]["table_status"]
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "tables_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "table_groups"
            referencedColumns: ["id"]
          },
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
      waiters: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          pin: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          pin: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          pin?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      zones: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          display_order: number
          id: string
          name: string
          restaurant_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          display_order?: number
          id?: string
          name: string
          restaurant_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          restaurant_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_ghost_sessions: { Args: { _restaurant: string }; Returns: number }
      combine_tables: {
        Args: { _restaurant: string; _table_ids: string[] }
        Returns: string
      }
      delete_table_safe: { Args: { _table: string }; Returns: Json }
      delete_waiter_safe: {
        Args: { _restaurant: string; _waiter: string }
        Returns: undefined
      }
      get_tenant_by_slug: {
        Args: { _slug: string }
        Returns: {
          analytics_enabled: boolean
          kitchen_bar_enabled: boolean
          menu_enabled: boolean
          name: string
          payments_enabled: boolean
          pos_enabled: boolean
          printing_enabled: boolean
          public_booking_enabled: boolean
          reservations_enabled: boolean
          restaurant_id: string
          slug: string
          status: Database["public"]["Enums"]["restaurant_status"]
          tickets_enabled: boolean
          type: Database["public"]["Enums"]["restaurant_type"]
        }[]
      }
      get_user_restaurant_id: { Args: { _user_id: string }; Returns: string }
      get_user_restaurants: {
        Args: { _user: string }
        Returns: {
          name: string
          restaurant_id: string
          role: Database["public"]["Enums"]["restaurant_role"]
          slug: string
          status: Database["public"]["Enums"]["restaurant_user_status"]
        }[]
      }
      has_restaurant_role: {
        Args: {
          _restaurant: string
          _role: Database["public"]["Enums"]["restaurant_role"]
          _user: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_restaurant_member: {
        Args: { _restaurant: string; _user: string }
        Returns: boolean
      }
      list_global_users: {
        Args: never
        Returns: {
          email: string
          global_roles: Database["public"]["Enums"]["user_role"][]
          last_sign_in_at: string
          name: string
          restaurants: Json
          status: string
          user_id: string
        }[]
      }
      list_restaurant_members: {
        Args: { _restaurant: string }
        Returns: {
          created_at: string
          email: string
          name: string
          role: Database["public"]["Enums"]["restaurant_role"]
          status: Database["public"]["Enums"]["restaurant_user_status"]
          user_id: string
        }[]
      }
      recalc_table_group: { Args: { _group: string }; Returns: undefined }
      session_has_real_activity: {
        Args: { _session: string }
        Returns: boolean
      }
      split_table_group: { Args: { _group: string }; Returns: undefined }
      unlink_restaurant_user: {
        Args: { _restaurant: string; _user: string }
        Returns: undefined
      }
    }
    Enums: {
      floor_element_type:
        | "bar"
        | "wall"
        | "separator"
        | "text"
        | "zone_block"
        | "decoration"
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
      printer_station: "cocina" | "barra" | "tickets"
      printer_type: "browser_print" | "network" | "escpos" | "epson_epos"
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
      restaurant_role: "restaurant_admin" | "manager" | "waiter"
      restaurant_status: "active" | "inactive"
      restaurant_type: "production" | "demo"
      restaurant_user_status: "active" | "inactive"
      session_status: "active" | "billing" | "closed"
      table_status: "available" | "occupied" | "reserved" | "needs_attention"
      user_role: "admin" | "manager" | "waiter" | "platform_admin"
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
      floor_element_type: [
        "bar",
        "wall",
        "separator",
        "text",
        "zone_block",
        "decoration",
      ],
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
      printer_station: ["cocina", "barra", "tickets"],
      printer_type: ["browser_print", "network", "escpos", "epson_epos"],
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
      restaurant_role: ["restaurant_admin", "manager", "waiter"],
      restaurant_status: ["active", "inactive"],
      restaurant_type: ["production", "demo"],
      restaurant_user_status: ["active", "inactive"],
      session_status: ["active", "billing", "closed"],
      table_status: ["available", "occupied", "reserved", "needs_attention"],
      user_role: ["admin", "manager", "waiter", "platform_admin"],
    },
  },
} as const
