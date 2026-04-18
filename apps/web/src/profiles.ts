import { getSupabaseClient, hasSupabaseConfig } from "./lib/supabase";

export type UserProfile = {
  userId: string;
  username: string | null;
  displayName: string | null;
  eloRating: number;
};

type ProfileRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  elo_rating: number | null;
};

function mapProfile(row: ProfileRow): UserProfile {
  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    eloRating: row.elo_rating ?? 1200
  };
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function validateUsername(username: string) {
  if (!/^[a-z0-9_]{3,24}$/u.test(username)) {
    throw new Error("Username must be 3-24 chars using lowercase letters, numbers, or underscores.");
  }
}

async function requireAuthenticatedUserId() {
  if (!hasSupabaseConfig) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error("Sign in to update your profile.");
  }

  return { supabase, userId: user.id };
}

export async function loadCurrentUserProfile(): Promise<UserProfile | null> {
  const auth = await requireAuthenticatedUserId();

  const { data, error } = await auth.supabase
    .from("profiles")
    .select("user_id, username, display_name, elo_rating")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapProfile(data as ProfileRow);
}

export async function saveCurrentUserProfile(input: {
  username: string;
  displayName: string;
}): Promise<UserProfile> {
  const auth = await requireAuthenticatedUserId();
  const username = normalizeUsername(input.username);
  validateUsername(username);

  const displayName = input.displayName.trim() || null;

  const { data, error } = await auth.supabase
    .from("profiles")
    .upsert(
      {
        user_id: auth.userId,
        username,
        display_name: displayName
      },
      {
        onConflict: "user_id"
      }
    )
    .select("user_id, username, display_name, elo_rating")
    .single();

  if (error || !data) {
    throw error ?? new Error("Could not save profile.");
  }

  return mapProfile(data as ProfileRow);
}
