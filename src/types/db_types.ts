// src/types/db_types.ts

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
      // --- Core Subscription/User Tables ---
      customers: {
        Row: {
          id: string // UUID
          stripe_customer_id: string | null
        }
        Insert: {
          id: string // UUID
          stripe_customer_id?: string | null
        }
        Update: {
          id?: string // UUID
          stripe_customer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_id_fkey"
            columns: ["id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      prices: {
        Row: {
          active: boolean | null
          currency: string | null
          description: string | null
          id: string // Stripe Price ID
          interval: Database["public"]["Enums"]["pricing_plan_interval"] | null
          interval_count: number | null
          metadata: Json | null
          product_id: string | null // Stripe Product ID
          trial_period_days: number | null
          type: Database["public"]["Enums"]["pricing_type"] | null
          unit_amount: number | null // In cents
        }
        Insert: {
          active?: boolean | null
          currency?: string | null
          description?: string | null
          id: string // Stripe Price ID
          interval?: Database["public"]["Enums"]["pricing_plan_interval"] | null
          interval_count?: number | null
          metadata?: Json | null
          product_id?: string | null // Stripe Product ID
          trial_period_days?: number | null
          type?: Database["public"]["Enums"]["pricing_type"] | null
          unit_amount?: number | null // In cents
        }
        Update: {
          active?: boolean | null
          currency?: string | null
          description?: string | null
          id?: string // Stripe Price ID
          interval?: Database["public"]["Enums"]["pricing_plan_interval"] | null
          interval_count?: number | null
          metadata?: Json | null
          product_id?: string | null // Stripe Product ID
          trial_period_days?: number | null
          type?: Database["public"]["Enums"]["pricing_type"] | null
          unit_amount?: number | null // In cents
        }
        Relationships: [
          {
            foreignKeyName: "prices_product_id_fkey"
            columns: ["product_id"]
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          description: string | null
          id: string // Stripe Product ID
          image: string | null
          metadata: Json | null
          name: string | null
        }
        Insert: {
          active?: boolean | null
          description?: string | null
          id: string // Stripe Product ID
          image?: string | null
          metadata?: Json | null
          name?: string | null
        }
        Update: {
          active?: boolean | null
          description?: string | null
          id?: string // Stripe Product ID
          image?: string | null
          metadata?: Json | null
          name?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at: string | null // ISO 8601 format
          cancel_at_period_end: boolean | null
          canceled_at: string | null // ISO 8601 format
          created: string // ISO 8601 format
          current_period_end: string // ISO 8601 format
          current_period_start: string // ISO 8601 format
          ended_at: string | null // ISO 8601 format
          id: string // Stripe Subscription ID
          metadata: Json | null
          price_id: string | null // Stripe Price ID
          quantity: number | null
          status: Database["public"]["Enums"]["subscription_status"] | null
          trial_end: string | null // ISO 8601 format
          trial_start: string | null // ISO 8601 format
          user_id: string // UUID
        }
        Insert: {
          cancel_at?: string | null // ISO 8601 format
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null // ISO 8601 format
          created?: string // ISO 8601 format
          current_period_end?: string // ISO 8601 format
          current_period_start?: string // ISO 8601 format
          ended_at?: string | null // ISO 8601 format
          id: string // Stripe Subscription ID
          metadata?: Json | null
          price_id?: string | null // Stripe Price ID
          quantity?: number | null
          status?: Database["public"]["Enums"]["subscription_status"] | null
          trial_end?: string | null // ISO 8601 format
          trial_start?: string | null // ISO 8601 format
          user_id: string // UUID
        }
        Update: {
          cancel_at?: string | null // ISO 8601 format
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null // ISO 8601 format
          created?: string // ISO 8601 format
          current_period_end?: string // ISO 8601 format
          current_period_start?: string // ISO 8601 format
          ended_at?: string | null // ISO 8601 format
          id?: string // Stripe Subscription ID
          metadata?: Json | null
          price_id?: string | null // Stripe Price ID
          quantity?: number | null
          status?: Database["public"]["Enums"]["subscription_status"] | null
          trial_end?: string | null // ISO 8601 format
          trial_start?: string | null // ISO 8601 format
          user_id?: string // UUID
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_price_id_fkey"
            columns: ["price_id"]
            referencedRelation: "prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          billing_address: Json | null
          full_name: string | null
          id: string // UUID
          last_credits_reset_date: string | null // ISO 8601 format
          payment_method: Json | null
          purchased_credits: number // Non-nullable, default 0
          subscription_credits: number // Non-nullable, default 0
        }
        Insert: {
          avatar_url?: string | null
          billing_address?: Json | null
          full_name?: string | null
          id: string // UUID
          last_credits_reset_date?: string | null // ISO 8601 format
          payment_method?: Json | null
          purchased_credits?: number
          subscription_credits?: number
        }
        Update: {
          avatar_url?: string | null
          billing_address?: Json | null
          full_name?: string | null
          id?: string // UUID
          last_credits_reset_date?: string | null // ISO 8601 format
          payment_method?: Json | null
          purchased_credits?: number
          subscription_credits?: number
        }
        Relationships: [
          {
            foreignKeyName: "users_id_fkey"
            columns: ["id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }

      // --- Credit System Tables ---
      credit_purchases: {
        Row: {
          amount: number
          created_at: string // ISO 8601 format
          id: string // UUID
          price_id: string // Stripe Price ID
          user_id: string // UUID
        }
        Insert: {
          amount: number
          created_at?: string // ISO 8601 format
          id?: string // UUID
          price_id: string // Stripe Price ID
          user_id: string // UUID
        }
        Update: {
          amount?: number
          created_at?: string // ISO 8601 format
          id?: string // UUID
          price_id?: string // Stripe Price ID
          user_id?: string // UUID
        }
        Relationships: [
          {
            foreignKeyName: "credit_purchases_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_usage: {
        Row: {
          amount: number
          created_at: string // ISO 8601 format
          description: string | null
          id: string // UUID
          user_id: string // UUID
        }
        Insert: {
          amount: number
          created_at?: string // ISO 8601 format
          description?: string | null
          id?: string // UUID
          user_id: string // UUID
        }
        Update: {
          amount?: number
          created_at?: string // ISO 8601 format
          description?: string | null
          id?: string // UUID
          user_id?: string // UUID
        }
        Relationships: [
          {
            foreignKeyName: "credit_usage_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }

      // --- Storytime AI Tables ---
      books: {
        Row: {
          id: string // UUID
          user_id: string // UUID
          title: string
          original_prompt: string | null
          short_description: string | null
          cover_image_prompt: string | null
          cover_image_url: string | null
          cover_storage_path: string | null
          status: Database["public"]["Enums"]["book_status"]
          share_id: string | null
          credits_cost: number
          error_message: string | null
          created_at: string // ISO 8601 format
          updated_at: string // ISO 8601 format
          metadata: Json | null // Added metadata field
        }
        Insert: {
          id?: string // UUID
          user_id: string // UUID
          title: string
          original_prompt?: string | null
          short_description?: string | null
          cover_image_prompt?: string | null
          cover_image_url?: string | null
          cover_storage_path?: string | null
          status?: Database["public"]["Enums"]["book_status"]
          share_id?: string | null
          credits_cost?: number
          error_message?: string | null
          created_at?: string // ISO 8601 format
          updated_at?: string // ISO 8601 format
          metadata?: Json | null // Added metadata field
        }
        Update: {
          id?: string // UUID
          user_id?: string // UUID
          title?: string
          original_prompt?: string | null
          short_description?: string | null
          cover_image_prompt?: string | null
          cover_image_url?: string | null
          cover_storage_path?: string | null
          status?: Database["public"]["Enums"]["book_status"]
          share_id?: string | null
          credits_cost?: number
          error_message?: string | null
          created_at?: string // ISO 8601 format
          updated_at?: string // ISO 8601 format
          metadata?: Json | null // Added metadata field
        }
        Relationships: [
          {
            foreignKeyName: "books_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      book_pages: {
        Row: {
          id: string // UUID
          book_id: string // UUID
          page_number: number
          text: string | null
          image_prompt: string | null
          image_url: string | null
          storage_path: string | null
          generation_status: string // 'pending', 'processing', 'completed', 'failed'
          created_at: string // ISO 8601 format
          updated_at: string // ISO 8601 format
          metadata: Json | null // Added metadata field
        }
        Insert: {
          id?: string // UUID
          book_id: string // UUID
          page_number: number
          text?: string | null
          image_prompt?: string | null
          image_url?: string | null
          storage_path?: string | null
          generation_status?: string
          created_at?: string // ISO 8601 format
          updated_at?: string // ISO 8601 format
          metadata?: Json | null // Added metadata field
        }
        Update: {
          id?: string // UUID
          book_id?: string // UUID
          page_number?: number
          text?: string | null
          image_prompt?: string | null
          image_url?: string | null
          storage_path?: string | null
          generation_status?: string
          created_at?: string // ISO 8601 format
          updated_at?: string // ISO 8601 format
          metadata?: Json | null // Added metadata field
        }
        Relationships: [
          {
            foreignKeyName: "book_pages_book_id_fkey"
            columns: ["book_id"]
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      // --- Standard Functions ---
      handle_new_user: {
        Args: Record<PropertyKey, never>
        Returns: unknown // Type typically 'trigger' if generated by CLI
      }
      update_updated_at_column: {
        Args: Record<PropertyKey, never>
        Returns: unknown // Type typically 'trigger' if generated by CLI
      }
      // --- ADDED RPC FUNCTIONS ---
      get_book_with_pages: {
        Args: {
          requested_book_id: string // UUID
        }
        // The function returns a single JSON object or NULL
        Returns: { book: Json; pages: Json[] } | null
      }
      get_book_with_pages_public: {
         Args: {
           requested_share_id: string // TEXT
         }
         // The function returns a single JSON object or NULL
         Returns: { book: Json; pages: Json[] } | null
      }
    }
    Enums: {
      book_status:
        | "pending"
        | "generating_text"
        | "generating_images"
        | "failed"
        | "completed"
      pricing_plan_interval: "day" | "week" | "month" | "year"
      pricing_type: "one_time" | "recurring"
      subscription_status:
        | "trialing"
        | "active"
        | "canceled"
        | "incomplete"
        | "incomplete_expired"
        | "past_due"
        | "unpaid"
        | "paused"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// --- Export Specific Row Types ---
export type User = Database["public"]["Tables"]["users"]["Row"]
export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"] & {
  prices?: Price
}
export type Product = Database["public"]["Tables"]["products"]["Row"]
export type Price = Database["public"]["Tables"]["prices"]["Row"] & {
  products?: Product
}
export type Customer = Database["public"]["Tables"]["customers"]["Row"]
export type CreditPurchase = Database["public"]["Tables"]["credit_purchases"]["Row"]
export type CreditUsage = Database["public"]["Tables"]["credit_usage"]["Row"]
export type Book = Database["public"]["Tables"]["books"]["Row"]
export type BookPage = Database["public"]["Tables"]["book_pages"]["Row"]

// --- Export Specific Enum Types ---
export type BookStatus = Database["public"]["Enums"]["book_status"]
export type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"]
export type PricingType = Database["public"]["Enums"]["pricing_type"]
export type PricingPlanInterval = Database["public"]["Enums"]["pricing_plan_interval"]

// Type helper for RPC function return type
// You might need to adjust this based on the actual JSON structure returned by your function
export type BookWithPagesRpcReturn = {
    book: Book;
    pages: BookPage[];
} | null; // Allow null if the function can return null

