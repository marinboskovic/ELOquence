'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { Game, Move, patternToTiles, CLASSIFICATION_CONFIG, Classification } from '@/lib/types';
import { Label, MiniTiles, Reveal, Tag } from '@/components/ui';
import { AdminLoading, AdminPage, EmptyBand, ErrorBand, PanelHead, StatusTag } from '../../_shared';

interface AdminGameDetail extends Game {
  username: string | null;
}

function GuessRow({ move }: { move: Move }) {
  const tiles = patternToTiles(move.pattern);
  const states = tiles.map((t) => (t === 'empty' || t === 'tbd' ? 'absent' : t)) as ('correct' | 'present' | 'absent')[];

  const classConf = move.classification
    ? CLASSIFICATION_CONFIG[move.classification as Classification]
    : null;

  return (
    <li className="flex items-center gap-4 py-3 border-b border-border-subtle">
      {/* Move number */}
      <span className="font-display font-black text-display-sm tabular text-text-tertiary w-6 text-right shrink-0">
        {move.move_number}
      </span>

      {/* Tiles */}
      <MiniTiles word={move.guess_word.toUpperCase()} states={states} size={26} gap={3} />

      {/* Classification */}
      {classConf && (
        <Tag dot={classConf.color}>{classConf.label}</Tag>
      )}

      {/* Metrics */}
      <div className="flex items-center gap-4 ml-auto text-right flex-wrap justify-end font-mono text-xs tabular">
        {move.optimal_word && move.optimal_word !== move.guess_word && (
          <span className="text-text-tertiary">
            opt <span className="text-text-secondary uppercase">{move.optimal_word}</span>
          </span>
        )}
        {move.info_gained !== null && (
          <span className="text-text-secondary">{move.info_gained.toFixed(2)} bits</span>
        )}
        {move.bits_lost !== null && move.bits_lost > 0 && (
          <span className="text-text-primary">−{move.bits_lost.toFixed(2)} lost</span>
        )}
        {move.remaining_words !== null && (
          <span className="text-text-tertiary">{move.remaining_words} left</span>
        )}
      </div>
    </li>
  );
}

function InfoList({ items }: { items: Array<{ label: string; value: string | number | null | undefined }> }) {
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6">
      {items.map(({ label, value }) => (
        <div key={label} className="rule-hair py-3">
          <dt><Label>{label}</Label></dt>
          <dd className="font-mono text-sm text-text-primary tabular mt-1">{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function AdminGameDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const gameId = params.id;

  const [game, setGame] = useState<AdminGameDetail | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!user || !user.is_admin) {
      router.replace('/play');
      return;
    }
    adminApi.game(gameId)
      .then((res) => setGame(res.data))
      .catch(() => setError('Failed to load game.'))
      .finally(() => setFetching(false));
  }, [user, loading, router, gameId]);

  if (loading || fetching) return <AdminLoading />;

  if (!user?.is_admin) return null;

  if (error || !game) {
    return (
      <AdminPage eyebrow="admin · game" title="Game" crumbs={[['games', '/admin/games']]}>
        {error ? <ErrorBand>{error}</ErrorBand> : <EmptyBand>Game not found.</EmptyBand>}
      </AdminPage>
    );
  }

  const sortedMoves = [...(game.moves ?? [])].sort((a, b) => a.move_number - b.move_number);

  const duration =
    game.created_at && game.completed_at
      ? Math.round(
          (new Date(game.completed_at).getTime() - new Date(game.created_at).getTime()) / 1000
        )
      : null;
  const durationStr = duration !== null
    ? duration < 60
      ? `${duration}s`
      : `${Math.floor(duration / 60)}m ${duration % 60}s`
    : null;

  const eloDeltaStr = game.elo_delta !== null
    ? `${game.elo_delta > 0 ? '+' : ''}${game.elo_delta}`
    : null;

  const word = (game.target_word ?? '').toUpperCase();

  return (
    <AdminPage
      eyebrow={`admin · game · ${game.mode}`}
      title={game.username ?? 'Guest'}
      crumbs={[['games', '/admin/games']]}
      aside={
        <div className="flex items-center gap-2 flex-wrap md:justify-end">
          <StatusTag status={game.status} />
          <Tag>{game.mode}</Tag>
          {game.hard_mode && <Tag tone="ochre">hard</Tag>}
          {game.username && game.user_id && (
            <Link href={`/admin/users/${game.user_id}`} className="ink-link font-mono text-label uppercase text-text-secondary">
              open user
            </Link>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-12 md:gap-16">
        {/* ── The word: ink block ── */}
        <Reveal as="section" className="bg-bg-ink text-text-on-ink p-6 md:p-10 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-6">
            <Label className="text-text-on-ink opacity-70 block mb-3">target word</Label>
            {word ? (
              <MiniTiles word={word} states={Array(word.length).fill('correct')} size={48} gap={6} />
            ) : (
              <span className="font-display text-display-md">—</span>
            )}
          </div>
          <div className="md:col-span-6 grid grid-cols-3 gap-6">
            <div>
              <Label className="text-text-on-ink opacity-70 block">guesses</Label>
              <div className="font-display text-display-md tabular">{game.num_guesses > 0 ? game.num_guesses : '—'}</div>
            </div>
            <div>
              <Label className="text-text-on-ink opacity-70 block">accuracy</Label>
              <div className="font-display text-display-md tabular">
                {game.accuracy_score !== null ? `${game.accuracy_score.toFixed(0)}%` : '—'}
              </div>
            </div>
            <div>
              <Label className="text-text-on-ink opacity-70 block">elo</Label>
              <div className="font-display text-display-md tabular">{eloDeltaStr ?? '—'}</div>
            </div>
          </div>
        </Reveal>

        {/* ── Game info ── */}
        <Reveal as="section" delay={0.05}>
          <PanelHead title="Game info" aside={gameId} />
          <InfoList items={[
            { label: 'target word', value: word || null },
            { label: 'mode', value: game.mode },
            { label: 'status', value: game.status.replace('_', ' ') },
            { label: 'difficulty', value: game.word_difficulty },
            { label: 'hard mode', value: game.hard_mode ? 'yes' : 'no' },
            { label: 'rated', value: game.rated ? 'yes' : 'no' },
            { label: 'placement', value: game.is_placement ? 'yes' : 'no' },
            { label: 'guesses', value: game.num_guesses > 0 ? game.num_guesses : '—' },
            { label: 'created', value: new Date(game.created_at).toLocaleString() },
            { label: 'completed', value: game.completed_at ? new Date(game.completed_at).toLocaleString() : '—' },
            { label: 'duration', value: durationStr },
            { label: 'elo before', value: game.elo_before },
            { label: 'elo after', value: game.elo_after },
            { label: 'elo delta', value: eloDeltaStr },
            { label: 'accuracy', value: game.accuracy_score !== null ? `${game.accuracy_score.toFixed(1)}%` : null },
            { label: 'luck factor', value: game.luck_factor !== null ? game.luck_factor?.toFixed(2) : null },
          ]} />
        </Reveal>

        {/* ── Moves ── */}
        {sortedMoves.length > 0 && (
          <Reveal as="section" delay={0.1}>
            <PanelHead title="Moves" aside={`${sortedMoves.length} of 6`} />
            <ul>
              {sortedMoves.map((move) => (
                <GuessRow key={move.id} move={move} />
              ))}
            </ul>
          </Reveal>
        )}
      </div>
    </AdminPage>
  );
}
