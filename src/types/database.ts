export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      contacts: {
        Row: {
          user_id: string;
          friend_id: string;
          status: string;
        };
        Insert: {
          user_id: string;
          friend_id: string;
          status?: string;
        };
        Update: {
          user_id?: string;
          friend_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contacts_friend_id_fkey";
            columns: ["friend_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contacts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      calls: {
        Row: {
          id: string;
          caller_id: string;
          callee_id: string;
          mode: string;
          answered: boolean;
          duration_seconds: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          caller_id: string;
          callee_id: string;
          mode?: string;
          answered?: boolean;
          duration_seconds?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          caller_id?: string;
          callee_id?: string;
          mode?: string;
          answered?: boolean;
          duration_seconds?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calls_caller_id_fkey";
            columns: ["caller_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calls_callee_id_fkey";
            columns: ["callee_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      conversation_members: {
        Row: {
          conversation_id: string;
          user_id: string;
          last_read_at: string | null;
          muted: boolean;
          hidden_message_ids: string[];
          cleared_at: string | null;
        };
        Insert: {
          conversation_id: string;
          user_id: string;
          last_read_at?: string | null;
          muted?: boolean;
          hidden_message_ids?: string[];
          cleared_at?: string | null;
        };
        Update: {
          conversation_id?: string;
          user_id?: string;
          last_read_at?: string | null;
          muted?: boolean;
          hidden_message_ids?: string[];
          cleared_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          id: string;
          type: string;
          title: string | null;
          avatar_url: string | null;
          created_by: string | null;
          last_message_at: string | null;
        };
        Insert: {
          id?: string;
          type?: string;
          title?: string | null;
          avatar_url?: string | null;
          created_by?: string | null;
          last_message_at?: string | null;
        };
        Update: {
          id?: string;
          type?: string;
          title?: string | null;
          avatar_url?: string | null;
          created_by?: string | null;
          last_message_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string | null;
          body: string | null;
          media_url: string | null;
          media_type: string | null;
          is_ai: boolean;
          reply_to: string | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id?: string | null;
          body?: string | null;
          media_url?: string | null;
          media_type?: string | null;
          is_ai?: boolean;
          reply_to?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string | null;
          body?: string | null;
          media_url?: string | null;
          media_type?: string | null;
          is_ai?: boolean;
          reply_to?: string | null;
          created_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_reply_to_fkey";
            columns: ["reply_to"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      stories: {
        Row: {
          id: string;
          user_id: string;
          media_url: string | null;
          caption: string | null;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          media_url?: string | null;
          caption?: string | null;
          created_at?: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          media_url?: string | null;
          caption?: string | null;
          created_at?: string;
          expires_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stories_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      story_views: {
        Row: {
          story_id: string;
          viewer_id: string;
          viewed_at: string;
        };
        Insert: {
          story_id: string;
          viewer_id: string;
          viewed_at?: string;
        };
        Update: {
          story_id?: string;
          viewer_id?: string;
          viewed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey";
            columns: ["story_id"];
            isOneToOne: false;
            referencedRelation: "stories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "story_views_viewer_id_fkey";
            columns: ["viewer_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          last_seen_at: string | null;
          created_at: string;
          status: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          last_seen_at?: string | null;
          created_at?: string;
          status?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          last_seen_at?: string | null;
          created_at?: string;
          status?: string;
        };
        Relationships: [
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_chats: {
        Args: Record<PropertyKey, never>;
        Returns: {
          chat_id: string;
          chat_type: string;
          title: string | null;
          avatar_url: string | null;
          last_message: string | null;
          last_message_at: string | null;
          unread_count: number;
        }[];
      };
      is_member: {
        Args: { cid: string };
        Returns: boolean;
      };
      post_ai_reply: {
        Args: { cid: string; body: string };
        Returns: string;
      };
      register_account: {
        Args: {
          p_email: string;
          p_password: string;
          p_username: string;
          p_display_name?: string;
        };
        Returns: string;
      };
      start_ai_chat: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      start_direct_chat: {
        Args: { other: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];

// Convenience aliases used across the app
export type UserRow = Tables<"users">;
export type ContactRow = Tables<"contacts">;
export type ConversationRow = Tables<"conversations">;
export type ConversationMemberRow = Tables<"conversation_members">;
export type CallRow = Tables<"calls">;
export type MessageRow = Tables<"messages">;
export type StoryRow = Tables<"stories">;
export type StoryViewRow = Tables<"story_views">;

export type ChatRow = {
  chat_id: string;
  chat_type: string;
  title: string | null;
  avatar_url: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
};
