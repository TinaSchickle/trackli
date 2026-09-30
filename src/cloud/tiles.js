import { supabase, isCloudConfigured } from './supabase.js';
import { isAdmin } from './auth.js';
import { DEFAULT_TILES } from '../tiles.js';

// Liefert die Kachel-Keys, die dieses Konto sehen darf, oder null = alle
// (Admin bzw. ohne Cloud). Ohne Eintrag in tile_access gilt DEFAULT_TILES.
export async function getMyTiles(user) {
  if (!isCloudConfigured || isAdmin(user)) return null;
  if (!user) return DEFAULT_TILES;
  const { data, error } = await supabase
    .from('tile_access')
    .select('tiles')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data?.tiles ?? DEFAULT_TILES;
}
