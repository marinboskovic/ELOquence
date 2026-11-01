'use client';
/**
 * The private half of the profile page — the same four calls the old
 * /dashboard made. Only runs when `enabled` (the viewer is the profile's
 * owner); every endpoint here requires auth.
 *
 *   gamesApi.list        → the owner's games, scoped to the mode filter (capped at 20)
 *   challengesApi.mine   → routes Friends games to their results page
 *   usersApi.eloHistory  → 90-day rating history with per-game deltas
 *   usersApi.stats       → per-mode aggregates, words that beat you, pace, first word, guess quality
 */
import { useCallback, useEffect, useState } from 'react';
import { challengesApi, gamesApi, usersApi } from '@/lib/api';
import type { Classification, EloHistoryEntry, Game } from '@/lib/types';
import type { NemesisWord } from '@/components/dashboard/NemesisWords';
import type { FavouriteOpener, PaceStats } from '@/components/dashboard/PaceHabits';

export type ModeFilter = 'all' | 'daily' | 'competitive' | 'practice' | 'challenge';

export interface ModeStat {
  completed: number;
  wins: number;
  losses: number;
  win_rate: number;
  avg_guesses: number | null;
  distribution: Record<string, number>;
}

export interface UserStats {
  guess_distribution?: Record<string, number>;
  losses?: number;
  /** Per-mode aggregates over the player's ENTIRE history plus an `all`
   *  aggregate — computed server-side, so unlike the capped games list it
   *  is not limited to 20 games. */
  mode_stats?: Record<string, ModeStat>;
  nemesis_words?: NemesisWord[];
  pace?: PaceStats;
  favourite_opener?: FavouriteOpener | null;
  classification_mix?: Partial<Record<Classification, number>>;
  [key: string]: unknown;
}

export function useOwnerData(enabled: boolean, filter: ModeFilter) {
  const [games, setGames] = useState<Game[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [challengeCodeByWord, setChallengeCodeByWord] = useState<Record<string, string>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [eloHistory, setEloHistory] = useState<EloHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Games for the active filter. Refetched when it changes; the cancel guard
  // drops stale responses if the user flips filters quickly.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoadingGames(true);
    gamesApi
      .list({ per_page: 20, mode: filter === 'all' ? undefined : filter })
      .then((res) => {
        if (cancelled) return;
        const d = res.data;
        setGames(Array.isArray(d) ? d : d.games ?? d.items ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingGames(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, filter]);

  useEffect(() => {
    if (!enabled) return;
    challengesApi
      .mine()
      .then((res) => {
        const map: Record<string, string> = {};
        for (const c of res.data as Array<{ code: string; target_word: string }>) {
          map[c.target_word.toUpperCase()] = c.code;
        }
        setChallengeCodeByWord(map);
      })
      .catch(() => {});
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    setLoadingHistory(true);
    usersApi
      .eloHistory(90)
      .then((res) => {
        const d = res.data;
        setEloHistory(Array.isArray(d) ? d : d.history ?? d.entries ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    setLoadingStats(true);
    usersApi
      .stats()
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, [enabled]);

  const deleteGame = useCallback(async (gameId: string) => {
    setDeletingId(gameId);
    try {
      await gamesApi.delete(gameId);
      setGames((prev) => prev.filter((g) => g.id !== gameId));
    } catch {
      // silent — the row simply stays
    } finally {
      setDeletingId(null);
    }
  }, []);

  return { games, loadingGames, challengeCodeByWord, deletingId, deleteGame, eloHistory, loadingHistory, stats, loadingStats };
}
