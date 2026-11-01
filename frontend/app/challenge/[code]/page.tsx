'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Copy, Lock, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/lib/hooks/useAuth';
import { challengesApi, errorMessage } from '@/lib/api';
import TileSpinner from '@/components/TileSpinner';
import {
  Button,
  ButtonLink,
  Detail,
  Hint,
  Label,
  MiniTiles,
  PatternRow,
  Reveal,
  SplitWords,
  Tag,
  staggerChild,
  staggerParent,
} from '@/components/ui';
import { MODES, TERMS, fmtInt, resultSentence } from '@/lib/copy';
import type { GameStatus } from '@/lib/types';

interface ChallengeInfo {
  code: string;
  creator_id: string;
  creator_username: string | null;
  is_creator: boolean;
  word_difficulty: number | null;
  already_played: boolean;
  my_status: string | null;
  game_id: string | null;
}

interface ChallengeResult {
  rank: number | null;
  username: string;
  status: string;
  num_guesses: number;
  accuracy_score: number | null;
  time_seconds: number | null;
  is_creator: boolean;
  is_me?: boolean;
  completed_at: string | null;
  patterns?: number[] | null;
}

interface ChallengeResultsResponse {
  results: ChallengeResult[];
  word: string | null;
  my_status: string | null;
  my_game_id: string | null;
}

/* ------------------------------------------------------------------ */
/*  Pattern grid (letters never shown — safe to display to all)        */
/* ------------------------------------------------------------------ */

function PatternGrid({ patterns, size = 7 }: { patterns: number[]; size?: number }) {
  if (!patterns.length) return null;
  return (
    <div className="flex flex-col" style={{ gap: 2 }} role="img" aria-label={`${patterns.length}-row guess pattern`}>
      {patterns.map((p, r) => (
        <PatternRow key={r} pattern={p} size={size} gap={2} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading                                                            */
/* ------------------------------------------------------------------ */

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-page">
      <TileSpinner size="lg" label="Loading" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ChallengePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [challenge, setChallenge] = useState<ChallengeInfo | null>(null);
  const [results, setResults] = useState<ChallengeResult[]>([]);
  const [challengeWord, setChallengeWord] = useState<string | null>(null);
  const [myStatus, setMyStatus] = useState<string | null>(null);
  const [myGameId, setMyGameId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  // Initialise the share URL on the client only, to avoid a hydration flash
  // where the input renders empty during SSR / first paint.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShareUrl(`${window.location.origin}/challenge/${code}`);
    }
  }, [code]);

  useEffect(() => {
    if (!code || authLoading) return;
    if (!user) {
      // Keep the viral loop: bounce through login and land back here.
      router.replace(`/login?next=${encodeURIComponent(`/challenge/${code}`)}`);
      return;
    }

    // Both fetches are committed together so the page never shows results
    // while `challenge` is still null (avoids a late layout shift).
    Promise.all([
      challengesApi.get(code),
      challengesApi.results(code).catch(() => ({
        data: { results: [], word: null, my_status: null, my_game_id: null } as ChallengeResultsResponse,
      })),
    ])
      .then(([infoRes, resultsRes]) => {
        const info = infoRes.data as ChallengeInfo;
        const r = resultsRes.data as ChallengeResultsResponse;
        setChallenge(info);
        setResults(r.results || []);
        setChallengeWord(r.word ?? null);
        setMyStatus(r.my_status ?? info.my_status ?? null);
        setMyGameId(r.my_game_id ?? info.game_id ?? null);
      })
      .catch((err: unknown) => setError(errorMessage(err, 'This link does not work')))
      .finally(() => setLoading(false));
  }, [code, user, authLoading, router]);

  const handlePlay = async () => {
    if (!code || starting) return;
    setStarting(true);
    setError('');
    try {
      const res = await challengesApi.play(code);
      // Forward the code so the game-over sheet can link to everyone's results.
      router.push(`/game/${res.data.id}?challenge=${encodeURIComponent(code)}`);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Could not start the game'));
      setStarting(false);
    }
  };

  const handleResume = () => {
    if (!myGameId) return;
    router.push(`/game/${myGameId}?challenge=${encodeURIComponent(code)}`);
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/challenge/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: do nothing
    }
  };

  if (authLoading || loading) return <LoadingSpinner />;

  if (error && !challenge) {
    return (
      <div className="min-h-page flex items-center">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-16 w-full">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
            <section className="md:col-span-8 bg-bg-ink text-text-on-ink p-6 md:p-12 flex flex-col gap-6">
              <Label className="text-text-on-ink opacity-70">{MODES.challenge.name.toLowerCase()} · {code}</Label>
              <h1 className="font-display text-display-lg text-balance">This link does not work.</h1>
              <p className="text-base opacity-80 max-w-md">{error}</p>
            </section>
            <div className="md:col-span-4">
              <ButtonLink href="/play" size="lg" className="w-full">
                Back to Play
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const finishedResults = results.filter((r) => r.status !== 'in_progress');
  const inProgressResults = results.filter((r) => r.status === 'in_progress');
  const hasResults = finishedResults.length > 0;
  const iAmInProgress = myStatus === 'in_progress' && !!myGameId;
  const iAmFinished = myStatus === 'won' || myStatus === 'lost' || myStatus === 'abandoned';
  const showLeaderboard = hasResults && !!challenge?.already_played;
  const myUsername = user?.username ?? null;
  const creatorHandle = challenge?.creator_username ? `@${challenge.creator_username}` : null;

  const headline = iAmFinished
    ? 'Results'
    : iAmInProgress
    ? 'Your board is waiting'
    : challenge?.is_creator
    ? 'Your word for friends'
    : 'A friend sent you a word';

  const modeName = MODES.challenge.name.toLowerCase();
  const eyebrow = creatorHandle && !challenge?.is_creator ? `${modeName} · from ${creatorHandle}` : `${modeName} · ${code}`;

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-16 flex flex-col gap-12 md:gap-16">
      {/* ── Hero: 7/5 split — statement left, action + word right ── */}
      <header className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-end">
        <div className="md:col-span-7">
          <Label className="block mb-2">{eyebrow}</Label>
          <SplitWords text={headline} as="h1" className="font-display text-display-lg text-text-primary" />
          <div className="flex items-center gap-2 flex-wrap mt-5">
            {challenge?.word_difficulty != null && (
              <Detail>
                <Tag>
                  <Hint term="wordRating">{TERMS.wordRating.name}</Hint>
                  &nbsp;{fmtInt(Math.round(challenge.word_difficulty))}
                </Tag>
              </Detail>
            )}
            {/* Player count is hidden until the user has played, so the hero
                doesn't pre-leak engagement metadata to a fresh visitor. */}
            {results.length > 0 && challenge?.already_played && (
              <Tag>
                {results.length} {results.length === 1 ? 'player' : 'players'}
              </Tag>
            )}
            {inProgressResults.length > 0 && challenge?.already_played && (
              <Tag tone="ochre" dot="var(--accent)">
                {inProgressResults.length} still playing
              </Tag>
            )}
          </div>
        </div>

        <div className="md:col-span-5 flex flex-col gap-4">
          {iAmInProgress ? (
            <Button size="lg" className="w-full" onClick={handleResume}>
              Resume
            </Button>
          ) : !challenge?.already_played ? (
            <Button size="lg" className="w-full" onClick={handlePlay} loading={starting}>
              {starting ? 'Starting…' : 'Play this word'}
            </Button>
          ) : (
            myGameId && (
              <ButtonLink href={`/review/${myGameId}`} variant="secondary" size="lg" className="w-full">
                See your review
              </ButtonLink>
            )
          )}

          {challenge?.already_played && !challengeWord && (
            <p className="flex items-center gap-2 text-sm text-text-secondary">
              <Lock size={13} aria-hidden="true" />
              Finish your board to see the word
            </p>
          )}

          <AnimatePresence>
            {error && challenge && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-2 text-sm text-accent"
                role="alert"
              >
                <AlertCircle size={15} className="shrink-0 mt-0.5" aria-hidden="true" />
                <span>{error}</span>
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* ── The word — the one ink block on the page ───────────── */}
      {challengeWord && (
        <Reveal as="section" className="bg-bg-ink text-text-on-ink p-6 md:p-10 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-5">
            <Label className="text-text-on-ink opacity-70 block mb-3">the word</Label>
            <MiniTiles
              word={challengeWord.toUpperCase()}
              states={Array(challengeWord.length).fill('correct')}
              size={52}
              gap={6}
            />
          </div>
          <p className="md:col-span-7 text-base opacity-80 max-w-md">
            {iAmFinished
              ? myStatus === 'won'
                ? 'You found it. The table below shows how everyone else did.'
                : 'This was the answer. The table below shows how everyone else did.'
              : 'Shown because your board is finished.'}
          </p>
        </Reveal>
      )}

      {/* ── Results table ──────────────────────────────────────── */}
      {showLeaderboard && (
        <Reveal as="section" delay={0.05}>
          <div className="rule-top pt-3 flex items-end justify-between gap-4 mb-2">
            <div>
              <Label className="block mb-1">{modeName}</Label>
              <h2 className="font-display text-display-md text-text-primary">Who solved it</h2>
            </div>
            <span className="font-mono text-xs text-text-secondary tabular">
              {finishedResults.length} finished
            </span>
          </div>

          <motion.table
            className="w-full text-sm"
            variants={staggerParent}
            initial="hidden"
            animate="show"
          >
            <thead>
              <tr className="rule-top">
                <th className="py-2 pr-3 text-left font-normal w-12"><Label>#</Label></th>
                <th className="py-2 pr-3 text-left font-normal"><Label>player</Label></th>
                <th className="py-2 pr-3 text-left font-normal hidden sm:table-cell"><Label>pattern</Label></th>
                <th className="py-2 text-right font-normal"><Label>result</Label></th>
                <Detail>
                  <th className="py-2 pl-3 text-right font-normal">
                    <Label><Hint term="accuracy">{TERMS.accuracy.name}</Hint></Label>
                  </th>
                </Detail>
              </tr>
            </thead>
            <tbody>
              {finishedResults.map((entry) => {
                const isMe = entry.is_me ?? entry.username === myUsername;
                const lost = entry.status === 'lost';
                return (
                  <motion.tr
                    key={`${entry.username}-${entry.rank}`}
                    variants={staggerChild}
                    className={clsx(
                      'border-b border-border-subtle hover:bg-bg-elevated transition-colors align-middle',
                      isMe && 'bg-bg-elevated'
                    )}
                    style={isMe ? { boxShadow: 'inset 3px 0 0 0 var(--accent)' } : undefined}
                    aria-label={lost ? `${entry.username} did not solve the puzzle` : undefined}
                  >
                    <td className={clsx('py-3 pr-3 font-display font-black text-display-sm tabular', lost ? 'text-text-tertiary' : 'text-text-primary', isMe && 'pl-3')}>
                      {entry.rank ?? '—'}
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className={clsx('font-display font-bold truncate', lost ? 'text-text-secondary' : 'text-text-primary')} title={entry.username}>
                          {entry.username}
                        </span>
                        {isMe && <Tag tone="ink">you</Tag>}
                        {entry.is_creator && <Tag>picked the word</Tag>}
                      </div>
                      {entry.patterns && entry.patterns.length > 0 && (
                        <div className="sm:hidden mt-2">
                          <PatternGrid patterns={entry.patterns} size={6} />
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-3 hidden sm:table-cell">
                      {entry.patterns && entry.patterns.length > 0 ? (
                        <PatternGrid patterns={entry.patterns} />
                      ) : (
                        <span className="font-mono text-xs text-text-tertiary">—</span>
                      )}
                    </td>
                    <td className="py-3 text-right font-mono tabular text-text-primary whitespace-nowrap">
                      {lost ? (
                        <span className="text-text-tertiary">{resultSentence('lost')}</span>
                      ) : (
                        resultSentence(entry.status as GameStatus, entry.num_guesses)
                      )}
                    </td>
                    <Detail>
                      <td className="py-3 pl-3 text-right font-mono tabular text-text-secondary">
                        {entry.accuracy_score !== null ? Math.round(entry.accuracy_score) : '—'}
                      </td>
                    </Detail>
                  </motion.tr>
                );
              })}
            </tbody>
          </motion.table>
        </Reveal>
      )}

      {/* ── Share ──────────────────────────────────────────────── */}
      <Reveal as="section" delay={0.1} className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-12 rule-top pt-6">
        <div className="md:col-span-4">
          <Label className="block mb-1">share</Label>
          <h2 className="font-display text-display-sm text-text-primary">Send this link</h2>
          <p className="text-sm text-text-secondary mt-1">Everyone gets the same word.</p>
        </div>
        <div className="md:col-span-8 flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1 min-w-0 border-b-2 border-border-default py-3 font-mono text-sm text-text-secondary truncate" aria-label="Link to share">
            {shareUrl}
          </div>
          <Button type="button" variant="secondary" onClick={handleCopyLink} className="shrink-0">
            {copied ? (
              <>
                <Check size={14} aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Copy size={14} aria-hidden="true" />
                Copy
              </>
            )}
          </Button>
        </div>
      </Reveal>
    </div>
  );
}
