export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Locale = "en" | "ko";
export type DifficultyLevel = "gentle" | "steady" | "hard";
export type PreferredTime = "morning" | "afternoon" | "evening";
export type GoalStatus = "active" | "paused" | "completed" | "archived";
export type PlanSource = "ai" | "manual" | "recovery" | "seed";
export type PlanStatus = "draft" | "active" | "archived";
export type DailyActionStatus = "pending" | "completed" | "skipped" | "failed";
export type ActionLogType = "assigned" | "completed" | "failed" | "skipped" | "rescheduled";
export type FailureReason =
  | "too_big"
  | "too_tired"
  | "forgot"
  | "schedule_conflict"
  | "low_motivation"
  | "other";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "free";
export type NotificationChannel = "email" | "push" | "in_app";
export type NotificationStatus = "queued" | "sent" | "failed" | "canceled";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          locale: Locale;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          locale?: Locale;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          locale?: Locale;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      anchors: {
        Row: {
          id: string;
          user_id: string;
          label: string;
          cue: string;
          preferred_time: PreferredTime;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label: string;
          cue: string;
          preferred_time: PreferredTime;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          label?: string;
          cue?: string;
          preferred_time?: PreferredTime;
          created_at?: string;
          updated_at?: string;
        };
      };
      goals: {
        Row: {
          id: string;
          user_id: string;
          anchor_id: string | null;
          title: string;
          why: string | null;
          difficulty: DifficultyLevel;
          available_minutes: number;
          status: GoalStatus;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          anchor_id?: string | null;
          title: string;
          why?: string | null;
          difficulty: DifficultyLevel;
          available_minutes: number;
          status?: GoalStatus;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          anchor_id?: string | null;
          title?: string;
          why?: string | null;
          difficulty?: DifficultyLevel;
          available_minutes?: number;
          status?: GoalStatus;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
      };
      habit_plans: {
        Row: {
          id: string;
          goal_id: string;
          version: number;
          source: PlanSource;
          status: PlanStatus;
          based_on_plan_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          goal_id: string;
          version: number;
          source: PlanSource;
          status?: PlanStatus;
          based_on_plan_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          goal_id?: string;
          version?: number;
          source?: PlanSource;
          status?: PlanStatus;
          based_on_plan_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      micro_actions: {
        Row: {
          id: string;
          plan_id: string;
          position: number;
          title: string;
          details: string | null;
          duration_minutes: number;
          fallback_title: string;
          fallback_details: string | null;
          fallback_duration_minutes: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          position: number;
          title: string;
          details?: string | null;
          duration_minutes: number;
          fallback_title: string;
          fallback_details?: string | null;
          fallback_duration_minutes: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string;
          position?: number;
          title?: string;
          details?: string | null;
          duration_minutes?: number;
          fallback_title?: string;
          fallback_details?: string | null;
          fallback_duration_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      daily_actions: {
        Row: {
          id: string;
          goal_id: string;
          plan_id: string;
          micro_action_id: string;
          action_date: string;
          status: DailyActionStatus;
          used_fallback: boolean;
          notes: string | null;
          completed_at: string | null;
          failed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          goal_id: string;
          plan_id: string;
          micro_action_id: string;
          action_date: string;
          status?: DailyActionStatus;
          used_fallback?: boolean;
          notes?: string | null;
          completed_at?: string | null;
          failed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          goal_id?: string;
          plan_id?: string;
          micro_action_id?: string;
          action_date?: string;
          status?: DailyActionStatus;
          used_fallback?: boolean;
          notes?: string | null;
          completed_at?: string | null;
          failed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      action_logs: {
        Row: {
          id: string;
          daily_action_id: string;
          user_id: string;
          log_type: ActionLogType;
          status_from: DailyActionStatus | null;
          status_to: DailyActionStatus | null;
          failure_reason: FailureReason | null;
          notes: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          daily_action_id: string;
          user_id: string;
          log_type: ActionLogType;
          status_from?: DailyActionStatus | null;
          status_to?: DailyActionStatus | null;
          failure_reason?: FailureReason | null;
          notes?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          daily_action_id?: string;
          user_id?: string;
          log_type?: ActionLogType;
          status_from?: DailyActionStatus | null;
          status_to?: DailyActionStatus | null;
          failure_reason?: FailureReason | null;
          notes?: string | null;
          metadata?: Json;
          created_at?: string;
        };
      };
      weekly_reviews: {
        Row: {
          id: string;
          user_id: string;
          goal_id: string;
          week_start: string;
          completed_days: number;
          skipped_days: number;
          failed_days: number;
          best_streak: number;
          difficult_moments: string;
          helpful_pattern: string;
          next_adjustment: string;
          summary: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          goal_id: string;
          week_start: string;
          completed_days?: number;
          skipped_days?: number;
          failed_days?: number;
          best_streak?: number;
          difficult_moments: string;
          helpful_pattern: string;
          next_adjustment: string;
          summary?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          goal_id?: string;
          week_start?: string;
          completed_days?: number;
          skipped_days?: number;
          failed_days?: number;
          best_streak?: number;
          difficult_moments?: string;
          helpful_pattern?: string;
          next_adjustment?: string;
          summary?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          provider_customer_id: string | null;
          provider_subscription_id: string | null;
          plan_name: string;
          status: SubscriptionStatus;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider?: string;
          provider_customer_id?: string | null;
          provider_subscription_id?: string | null;
          plan_name?: string;
          status?: SubscriptionStatus;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          provider?: string;
          provider_customer_id?: string | null;
          provider_subscription_id?: string | null;
          plan_name?: string;
          status?: SubscriptionStatus;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          goal_id: string | null;
          channel: NotificationChannel;
          status: NotificationStatus;
          scheduled_for: string;
          sent_at: string | null;
          title: string | null;
          body: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          goal_id?: string | null;
          channel: NotificationChannel;
          status?: NotificationStatus;
          scheduled_for: string;
          sent_at?: string | null;
          title?: string | null;
          body: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          goal_id?: string | null;
          channel?: NotificationChannel;
          status?: NotificationStatus;
          scheduled_for?: string;
          sent_at?: string | null;
          title?: string | null;
          body?: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

export type UserRow = Database["public"]["Tables"]["users"]["Row"];
export type GoalRow = Database["public"]["Tables"]["goals"]["Row"];
export type AnchorRow = Database["public"]["Tables"]["anchors"]["Row"];
export type HabitPlanRow = Database["public"]["Tables"]["habit_plans"]["Row"];
export type MicroActionRow = Database["public"]["Tables"]["micro_actions"]["Row"];
export type DailyActionRow = Database["public"]["Tables"]["daily_actions"]["Row"];
export type ActionLogRow = Database["public"]["Tables"]["action_logs"]["Row"];
export type WeeklyReviewRow = Database["public"]["Tables"]["weekly_reviews"]["Row"];
