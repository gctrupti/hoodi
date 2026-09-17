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
      announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      category_suggestions: {
        Row: {
          created_at: string
          id: string
          module: string
          name: string
          note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          suggested_by: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          module: string
          name: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_by: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          module?: string
          name?: string
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_by?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          booking_id: string | null
          created_at: string
          id: string
          request_id: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          id?: string
          request_id?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          id?: string
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "skill_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_threads_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "help_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      help_requests: {
        Row: {
          accepted_at: string | null
          address_text: string | null
          ai_confidence: number | null
          ai_suggested_category:
            | Database["public"]["Enums"]["request_category"]
            | null
          ai_suggested_urgency:
            | Database["public"]["Enums"]["urgency_level"]
            | null
          cancelled_at: string | null
          category: Database["public"]["Enums"]["request_category"]
          commission_amount: number | null
          completed_at: string | null
          created_at: string
          delivery_stage: Database["public"]["Enums"]["delivery_stage"]
          description: string | null
          dropoff_address: string | null
          dropoff_lat: number | null
          dropoff_lng: number | null
          dropoff_name: string | null
          estimated_fare: number | null
          final_fare: number | null
          helper_id: string | null
          id: string
          is_paid: boolean
          location: unknown
          payment_id: string | null
          photo_url: string | null
          pickup_address: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_name: string | null
          request_type: Database["public"]["Enums"]["help_request_type"]
          requester_id: string
          status: Database["public"]["Enums"]["request_status"]
          title: string
          updated_at: string
          urgency: Database["public"]["Enums"]["urgency_level"]
        }
        Insert: {
          accepted_at?: string | null
          address_text?: string | null
          ai_confidence?: number | null
          ai_suggested_category?:
            | Database["public"]["Enums"]["request_category"]
            | null
          ai_suggested_urgency?:
            | Database["public"]["Enums"]["urgency_level"]
            | null
          cancelled_at?: string | null
          category?: Database["public"]["Enums"]["request_category"]
          commission_amount?: number | null
          completed_at?: string | null
          created_at?: string
          delivery_stage?: Database["public"]["Enums"]["delivery_stage"]
          description?: string | null
          dropoff_address?: string | null
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_name?: string | null
          estimated_fare?: number | null
          final_fare?: number | null
          helper_id?: string | null
          id?: string
          is_paid?: boolean
          location?: unknown
          payment_id?: string | null
          photo_url?: string | null
          pickup_address?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_name?: string | null
          request_type?: Database["public"]["Enums"]["help_request_type"]
          requester_id: string
          status?: Database["public"]["Enums"]["request_status"]
          title: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
        }
        Update: {
          accepted_at?: string | null
          address_text?: string | null
          ai_confidence?: number | null
          ai_suggested_category?:
            | Database["public"]["Enums"]["request_category"]
            | null
          ai_suggested_urgency?:
            | Database["public"]["Enums"]["urgency_level"]
            | null
          cancelled_at?: string | null
          category?: Database["public"]["Enums"]["request_category"]
          commission_amount?: number | null
          completed_at?: string | null
          created_at?: string
          delivery_stage?: Database["public"]["Enums"]["delivery_stage"]
          description?: string | null
          dropoff_address?: string | null
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_name?: string | null
          estimated_fare?: number | null
          final_fare?: number | null
          helper_id?: string | null
          id?: string
          is_paid?: boolean
          location?: unknown
          payment_id?: string | null
          photo_url?: string | null
          pickup_address?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_name?: string | null
          request_type?: Database["public"]["Enums"]["help_request_type"]
          requester_id?: string
          status?: Database["public"]["Enums"]["request_status"]
          title?: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"]
        }
        Relationships: [
          {
            foreignKeyName: "help_requests_helper_id_fkey"
            columns: ["helper_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_requests_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_flags: {
        Row: {
          created_at: string
          flagged_by: string
          id: string
          reason: string
          resolved: boolean
          resolved_by: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          flagged_by: string
          id?: string
          reason: string
          resolved?: boolean
          resolved_by?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          flagged_by?: string
          id?: string
          reason?: string
          resolved?: boolean
          resolved_by?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_flags_flagged_by_fkey"
            columns: ["flagged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_flags_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          booking_id: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          request_id: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          request_id?: string | null
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          request_id?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "skill_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "help_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string
          id: string
          payer_id: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          request_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          booking_id?: string | null
          created_at?: string
          id?: string
          payer_id: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          request_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          id?: string
          payer_id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          request_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "skill_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "help_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          id: string
          processed_at: string | null
          requested_at: string
          status: Database["public"]["Enums"]["payout_status"]
          wallet_id: string
        }
        Insert: {
          amount: number
          id?: string
          processed_at?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["payout_status"]
          wallet_id: string
        }
        Update: {
          amount?: number
          id?: string
          processed_at?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["payout_status"]
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      pricing_rules: {
        Row: {
          base_fee: number
          category: Database["public"]["Enums"]["request_category"]
          commission_rate: number
          created_at: string
          id: string
          rate_per_km: number
        }
        Insert: {
          base_fee?: number
          category: Database["public"]["Enums"]["request_category"]
          commission_rate?: number
          created_at?: string
          id?: string
          rate_per_km?: number
        }
        Update: {
          base_fee?: number
          category?: Database["public"]["Enums"]["request_category"]
          commission_rate?: number
          created_at?: string
          id?: string
          rate_per_km?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bio: string | null
          city: string | null
          country: string | null
          cover_image_url: string | null
          created_at: string
          formatted_address: string | null
          id: string
          is_active: boolean
          is_admin: boolean
          latitude: number | null
          location: unknown
          location_updated_at: string | null
          longitude: number | null
          name: string | null
          phone_number: string | null
          phone_verified: boolean
          profile_photo_url: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          bio?: string | null
          city?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          formatted_address?: string | null
          id: string
          is_active?: boolean
          is_admin?: boolean
          latitude?: number | null
          location?: unknown
          location_updated_at?: string | null
          longitude?: number | null
          name?: string | null
          phone_number?: string | null
          phone_verified?: boolean
          profile_photo_url?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          bio?: string | null
          city?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          formatted_address?: string | null
          id?: string
          is_active?: boolean
          is_admin?: boolean
          latitude?: number | null
          location?: unknown
          location_updated_at?: string | null
          longitude?: number | null
          name?: string | null
          phone_number?: string | null
          phone_verified?: boolean
          profile_photo_url?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          booking_id: string | null
          comment: string | null
          created_at: string
          id: string
          ratee_id: string
          rater_id: string
          request_id: string | null
          score: number
        }
        Insert: {
          booking_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          ratee_id: string
          rater_id: string
          request_id?: string | null
          score: number
        }
        Update: {
          booking_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          ratee_id?: string
          rater_id?: string
          request_id?: string | null
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "skill_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_ratee_id_fkey"
            columns: ["ratee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "help_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["request_status"]
          old_status: Database["public"]["Enums"]["request_status"] | null
          request_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: Database["public"]["Enums"]["request_status"]
          old_status?: Database["public"]["Enums"]["request_status"] | null
          request_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["request_status"]
          old_status?: Database["public"]["Enums"]["request_status"] | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_status_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "help_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_tracking: {
        Row: {
          created_at: string
          distance_meters: number | null
          eta_minutes: number | null
          heading: number | null
          helper_id: string
          latitude: number
          longitude: number
          request_id: string
          speed: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          distance_meters?: number | null
          eta_minutes?: number | null
          heading?: number | null
          helper_id: string
          latitude: number
          longitude: number
          request_id: string
          speed?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          distance_meters?: number | null
          eta_minutes?: number | null
          heading?: number | null
          helper_id?: string
          latitude?: number
          longitude?: number
          request_id?: string
          speed?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_tracking_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "help_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_bookings: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          commission_amount: number | null
          completed_at: string | null
          created_at: string
          duration_minutes: number
          id: string
          learner_id: string
          notes: string | null
          offering_id: string
          payment_id: string | null
          price: number
          scheduled_at: string
          status: Database["public"]["Enums"]["booking_status"]
          teacher_id: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          commission_amount?: number | null
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          learner_id: string
          notes?: string | null
          offering_id: string
          payment_id?: string | null
          price?: number
          scheduled_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          teacher_id: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          commission_amount?: number | null
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          learner_id?: string
          notes?: string | null
          offering_id?: string
          payment_id?: string | null
          price?: number
          scheduled_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_bookings_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_bookings_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "skill_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_bookings_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_offerings: {
        Row: {
          category: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_published: boolean
          price_per_session: number
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_published?: boolean
          price_per_session?: number
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_published?: boolean
          price_per_session?: number
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_offerings_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      teacher_profiles: {
        Row: {
          availability: string | null
          availability_slots: Json
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          experience_years: number
          formatted_address: string | null
          headline: string | null
          hourly_rate: number
          is_published: boolean
          languages: string[]
          latitude: number | null
          location: unknown
          longitude: number | null
          meeting_link: string | null
          meeting_provider: string | null
          state: string | null
          teaching_mode: Database["public"]["Enums"]["teaching_mode"]
          updated_at: string
          user_id: string
        }
        Insert: {
          availability?: string | null
          availability_slots?: Json
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          experience_years?: number
          formatted_address?: string | null
          headline?: string | null
          hourly_rate?: number
          is_published?: boolean
          languages?: string[]
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          meeting_link?: string | null
          meeting_provider?: string | null
          state?: string | null
          teaching_mode?: Database["public"]["Enums"]["teaching_mode"]
          updated_at?: string
          user_id: string
        }
        Update: {
          availability?: string | null
          availability_slots?: Json
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          experience_years?: number
          formatted_address?: string | null
          headline?: string | null
          hourly_rate?: number
          is_published?: boolean
          languages?: string[]
          latitude?: number | null
          location?: unknown
          longitude?: number | null
          meeting_link?: string | null
          meeting_provider?: string | null
          state?: string | null
          teaching_mode?: Database["public"]["Enums"]["teaching_mode"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      user_offer_tags: {
        Row: {
          created_at: string
          id: string
          tag: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tag: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tag?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_offer_tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_reports: {
        Row: {
          context_id: string | null
          context_type: string | null
          created_at: string
          details: string | null
          id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_user_id: string
          updated_at: string
        }
        Insert: {
          context_id?: string | null
          context_type?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_user_id: string
          updated_at?: string
        }
        Update: {
          context_id?: string | null
          context_type?: string | null
          created_at?: string
          details?: string | null
          id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_verifications: {
        Row: {
          created_at: string
          document_path: string | null
          id: string
          kind: Database["public"]["Enums"]["verification_kind"]
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["verification_status"]
          submitted_value: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_path?: string | null
          id?: string
          kind: Database["public"]["Enums"]["verification_kind"]
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          submitted_value?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_path?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["verification_kind"]
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          submitted_value?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      accept_help_request: {
        Args: { _order_id?: string; _request_id: string }
        Returns: {
          amount: number
          chat_thread_id: string
          is_paid: boolean
          payment_id: string
          request_id: string
        }[]
      }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      admin_overview: { Args: never; Returns: Json }
      admin_set_payout_status: {
        Args: {
          _new_status: Database["public"]["Enums"]["payout_status"]
          _payout_id: string
        }
        Returns: {
          amount: number
          id: string
          processed_at: string | null
          requested_at: string
          status: Database["public"]["Enums"]["payout_status"]
          wallet_id: string
        }
        SetofOptions: {
          from: "*"
          to: "payouts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      capture_booking_payment: {
        Args: { _external_payment_id?: string; _payment_id: string }
        Returns: {
          amount: number
          booking_id: string
          commission: number
          payment_id: string
          teacher_credit: number
          teacher_id: string
          wallet_balance: number
        }[]
      }
      capture_payment: {
        Args: { _payment_id: string; _razorpay_payment_id?: string }
        Returns: {
          amount: number
          commission: number
          helper_credit: number
          helper_id: string
          payment_id: string
          request_id: string
          wallet_balance: number
        }[]
      }
      counterparty_phone: { Args: { _other_id: string }; Returns: string }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      gettransactionid: { Args: never; Returns: unknown }
      insert_booking_notification: {
        Args: {
          _booking_id: string
          _message: string
          _type: Database["public"]["Enums"]["notification_type"]
          _user_id: string
        }
        Returns: undefined
      }
      insert_notification: {
        Args: {
          _message: string
          _request_id: string
          _type: Database["public"]["Enums"]["notification_type"]
          _user_id: string
        }
        Returns: string
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_booking_party: {
        Args: { _booking_id: string; _user_id: string }
        Returns: boolean
      }
      is_request_party: {
        Args: { _request_id: string; _user_id: string }
        Returns: boolean
      }
      is_thread_party: {
        Args: { _thread_id: string; _user_id: string }
        Returns: boolean
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      my_phone: { Args: never; Returns: string }
      nearby_open_requests: {
        Args: {
          _category?: Database["public"]["Enums"]["request_category"]
          _lat: number
          _lng: number
          _radius_m?: number
          _urgency?: Database["public"]["Enums"]["urgency_level"]
        }
        Returns: {
          address_text: string
          category: Database["public"]["Enums"]["request_category"]
          created_at: string
          description: string
          distance_m: number
          estimated_fare: number
          id: string
          is_paid: boolean
          latitude: number
          longitude: number
          photo_url: string
          requester_id: string
          title: string
          urgency: Database["public"]["Enums"]["urgency_level"]
        }[]
      }
      nearby_teachers: {
        Args: { _lat: number; _lng: number; _radius_m: number }
        Returns: {
          availability: string
          bio: string
          city: string
          distance_m: number
          experience_years: number
          formatted_address: string
          headline: string
          hourly_rate: number
          latitude: number
          longitude: number
          name: string
          profile_photo_url: string
          teacher_id: string
          teaching_mode: Database["public"]["Enums"]["teaching_mode"]
        }[]
      }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      profile_stats: {
        Args: { _user_id: string }
        Returns: {
          avg_score: number
          helps_completed: number
          member_since: string
          rating_count: number
          requests_posted: number
          sessions_learned: number
          sessions_taught: number
        }[]
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      user_rating_summary: {
        Args: { _user_id: string }
        Returns: {
          avg_score: number
          rating_count: number
        }[]
      }
      user_trust: {
        Args: { _user_id: string }
        Returns: {
          avg_score: number
          badges: string[]
          email_verified: boolean
          helps_completed: number
          id_verified: boolean
          is_verified: boolean
          phone_verified: boolean
          rating_count: number
          selfie_verified: boolean
          sessions_taught: number
        }[]
      }
    }
    Enums: {
      booking_status:
        | "requested"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
      delivery_stage:
        | "accepted"
        | "to_pickup"
        | "picked_up"
        | "on_the_way"
        | "delivered"
      help_request_type:
        | "pickup_delivery"
        | "home_assistance"
        | "transportation"
        | "elder_care"
        | "custom"
      notification_type:
        | "new_request_nearby"
        | "request_accepted"
        | "new_message"
        | "status_changed"
        | "request_completed"
        | "payout_update"
        | "booking_requested"
        | "booking_confirmed"
        | "booking_cancelled"
        | "booking_completed"
        | "session_reminder"
      payment_status: "pending" | "held" | "released" | "refunded"
      payout_status: "requested" | "approved" | "rejected" | "paid"
      report_reason:
        | "fake_profile"
        | "abuse"
        | "spam"
        | "harassment"
        | "scam"
        | "unsafe_behaviour"
        | "other"
      report_status: "open" | "reviewing" | "actioned" | "dismissed"
      request_category:
        | "grocery"
        | "elderly_care"
        | "transportation"
        | "errand"
        | "first_aid"
        | "other"
      request_status:
        | "open"
        | "accepted"
        | "in_progress"
        | "completed"
        | "cancelled"
      teaching_mode: "online" | "offline" | "both"
      urgency_level: "normal" | "today" | "emergency"
      verification_kind: "email" | "phone" | "government_id" | "selfie"
      verification_status: "pending" | "verified" | "rejected"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
      booking_status: [
        "requested",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
      ],
      delivery_stage: [
        "accepted",
        "to_pickup",
        "picked_up",
        "on_the_way",
        "delivered",
      ],
      help_request_type: [
        "pickup_delivery",
        "home_assistance",
        "transportation",
        "elder_care",
        "custom",
      ],
      notification_type: [
        "new_request_nearby",
        "request_accepted",
        "new_message",
        "status_changed",
        "request_completed",
        "payout_update",
        "booking_requested",
        "booking_confirmed",
        "booking_cancelled",
        "booking_completed",
        "session_reminder",
      ],
      payment_status: ["pending", "held", "released", "refunded"],
      payout_status: ["requested", "approved", "rejected", "paid"],
      report_reason: [
        "fake_profile",
        "abuse",
        "spam",
        "harassment",
        "scam",
        "unsafe_behaviour",
        "other",
      ],
      report_status: ["open", "reviewing", "actioned", "dismissed"],
      request_category: [
        "grocery",
        "elderly_care",
        "transportation",
        "errand",
        "first_aid",
        "other",
      ],
      request_status: [
        "open",
        "accepted",
        "in_progress",
        "completed",
        "cancelled",
      ],
      teaching_mode: ["online", "offline", "both"],
      urgency_level: ["normal", "today", "emergency"],
      verification_kind: ["email", "phone", "government_id", "selfie"],
      verification_status: ["pending", "verified", "rejected"],
    },
  },
} as const
