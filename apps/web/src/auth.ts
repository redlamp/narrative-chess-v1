import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "./lib/supabase";

export type AppRole = "reader" | "author" | "admin";

export async function signInWithGoogle() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.href
    }
  });
}

export async function signInWithPassword(input: {
  email: string;
  password: string;
}) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase.auth.signInWithPassword(input);
}

export async function signUpWithPassword(input: {
  email: string;
  password: string;
}) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase.auth.signUp({
    ...input,
    options: {
      emailRedirectTo: window.location.href
    }
  });
}

export async function signOut() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return;
  }

  await supabase.auth.signOut();
}

export async function bootstrapFirstAdmin(): Promise<AppRole | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.rpc("bootstrap_first_admin");
  if (error) {
    throw error;
  }

  return data === "admin" ? "admin" : null;
}

export async function getCurrentSession() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }

  return data.session;
}

export function subscribeToAuthChanges(
  callback: (session: Session | null) => void
) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return () => undefined;
  }

  const {
    data: { subscription }
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return () => subscription.unsubscribe();
}

export async function loadCurrentUserRole(user: User | null): Promise<AppRole> {
  if (!user) {
    return "reader";
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return "reader";
  }

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data?.role) {
    return "reader";
  }

  return data.role === "admin" ? "admin" : "author";
}
