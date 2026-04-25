import { gameSnapshotSchema } from "@narrative-chess/content-schema";
import { getSupabaseClient, hasSupabaseConfig } from "./lib/supabase";
import { parseSavedMatchCityMetadata } from "./playCityContext";
import type { SavedMatchRecord } from "./savedMatches";

type SavedMatchRow = {
  id: string;
  name: string;
  saved_at: string;
  move_count: number;
  city_metadata: unknown;
  snapshot: unknown;
};

async function requireAuthenticatedUserId() {
  if (!hasSupabaseConfig) {
    return null;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    return null;
  }

  return { supabase, userId: user.id };
}

function mapSavedMatchRow(row: SavedMatchRow): SavedMatchRecord {
  return {
    id: row.id,
    name: row.name,
    savedAt: row.saved_at,
    moveCount: row.move_count,
    cityMetadata: parseSavedMatchCityMetadata(row.city_metadata),
    snapshot: gameSnapshotSchema.parse(row.snapshot)
  } satisfies SavedMatchRecord;
}

export async function listSavedMatchesFromSupabase(): Promise<SavedMatchRecord[] | null> {
  const auth = await requireAuthenticatedUserId();
  if (!auth) {
    return null;
  }

  const { data, error } = await auth.supabase
    .from("user_saved_matches")
    .select("id, name, saved_at, move_count, city_metadata, snapshot")
    .eq("user_id", auth.userId)
    .order("saved_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as SavedMatchRow[]).map(mapSavedMatchRow);
}

export async function saveSavedMatchToSupabase(record: SavedMatchRecord): Promise<void> {
  const auth = await requireAuthenticatedUserId();
  if (!auth) {
    return;
  }

  const { error } = await auth.supabase
    .from("user_saved_matches")
    .upsert(
      {
        id: record.id,
        user_id: auth.userId,
        name: record.name,
        saved_at: record.savedAt,
        move_count: record.moveCount,
        city_metadata: record.cityMetadata,
        snapshot: record.snapshot
      },
      {
        onConflict: "id"
      }
    );

  if (error) {
    throw error;
  }
}

export async function deleteSavedMatchFromSupabase(id: string): Promise<void> {
  const auth = await requireAuthenticatedUserId();
  if (!auth) {
    return;
  }

  const { error } = await auth.supabase
    .from("user_saved_matches")
    .delete()
    .eq("user_id", auth.userId)
    .eq("id", id);

  if (error) {
    throw error;
  }
}
