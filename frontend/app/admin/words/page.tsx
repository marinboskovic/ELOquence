'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { Button, Label, MiniTiles, Reveal } from '@/components/ui';
import { AdminLoading, AdminPage, EmptyBand, ErrorBand, Field, INPUT, PanelHead, PanelLoading, TD, TH, TR } from '../_shared';

interface DailyWord {
  id: string;
  word: string;
  date: string;
  difficulty: number | null;
}

export default function AdminWordsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [words, setWords] = useState<DailyWord[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formWord, setFormWord] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formDifficulty, setFormDifficulty] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchWords = () => {
    adminApi
      .dailyWords()
      .then((res) => setWords(res.data))
      .catch(() => setError('Failed to load daily words.'))
      .finally(() => setFetching(false));
  };

  useEffect(() => {
    if (loading) return;
    if (!user || !user.is_admin) {
      router.replace('/play');
      return;
    }
    fetchWords();
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const wordClean = formWord.trim().toUpperCase();
    if (wordClean.length !== 5) {
      setFormError('Word must be exactly 5 characters.');
      return;
    }
    if (!formDate) {
      setFormError('Please select a date.');
      return;
    }
    setSubmitting(true);
    try {
      await adminApi.setDailyWord({ word: wordClean, date: formDate, difficulty: formDifficulty });
      setSuccess(`Scheduled "${wordClean}" for ${formDate}.`);
      setFormWord('');
      setFormDate('');
      setFormDifficulty(3);
      fetchWords();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFormError(detail || 'Failed to schedule word.');
    } finally {
      setSubmitting(false);
    }
  };

  const difficultyLabel = (d: number) => {
    if (d <= 1) return 'Very easy';
    if (d <= 2) return 'Easy';
    if (d <= 3) return 'Medium';
    if (d <= 4) return 'Hard';
    return 'Very hard';
  };

  if (loading) return <AdminLoading />;

  if (!user?.is_admin) return null;

  const sorted = [...words].sort((a, b) => a.date.localeCompare(b.date));
  const today = new Date().toISOString().slice(0, 10);
  const preview = (formWord + '     ').slice(0, 5);

  return (
    <AdminPage eyebrow={`admin · daily words · ${words.length} scheduled`} title="Words">
      {error && <ErrorBand onDismiss={() => setError('')}>{error}</ErrorBand>}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12">
        {/* ── Schedule form: 5 cols, the word previews as tiles ── */}
        <Reveal as="section" className="md:col-span-5">
          <PanelHead title="Schedule a word" />
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="bg-wash-green p-5 flex flex-col gap-3">
              <Label>preview</Label>
              <MiniTiles
                word={preview}
                states={preview.split('').map((ch) => (ch.trim() ? 'correct' : 'empty'))}
                size={44}
                gap={5}
              />
            </div>

            <Field label="word · 5 letters">
              <input
                type="text"
                value={formWord}
                onChange={(e) => setFormWord(e.target.value.toUpperCase().slice(0, 5))}
                placeholder="CRANE"
                maxLength={5}
                className={`${INPUT} font-display font-black uppercase tracking-[0.3em] text-lg`}
              />
            </Field>

            <Field label="date">
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className={`${INPUT} font-mono`}
              />
            </Field>

            <div>
              <div className="flex items-baseline justify-between mb-1">
                <Label>difficulty</Label>
                <span className="font-mono text-xs text-text-primary tabular">
                  {formDifficulty} · {difficultyLabel(formDifficulty)}
                </span>
              </div>
              <div role="radiogroup" aria-label="Difficulty" className="flex gap-1">
                {[1, 2, 3, 4, 5].map((d) => (
                  <Button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={formDifficulty === d}
                    variant={formDifficulty === d ? 'ink' : 'secondary'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setFormDifficulty(d)}
                  >
                    {d}
                  </Button>
                ))}
              </div>
              <div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary mt-1.5">
                <span>very easy</span>
                <span>very hard</span>
              </div>
            </div>

            {formError && <p className="text-sm text-[var(--red)]" role="alert">{formError}</p>}
            {success && (
              <p className="inline-flex items-center gap-1.5 text-sm text-text-primary" role="status">
                <Check size={14} style={{ color: 'var(--tile-correct)' }} aria-hidden="true" />
                {success}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" loading={submitting}>
              Schedule word
            </Button>
          </form>
        </Reveal>

        {/* ── Scheduled list: 7 cols ── */}
        <Reveal as="section" delay={0.05} className="md:col-span-7">
          <PanelHead title="Scheduled" aside="soonest first" />
          {fetching ? (
            <PanelLoading label="Loading words" rows={6} />
          ) : sorted.length === 0 ? (
            <EmptyBand>No daily words scheduled.</EmptyBand>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="rule-top">
                  <th className={TH}><Label>date</Label></th>
                  <th className={TH}><Label>word</Label></th>
                  <th className={`${TH} text-right`}><Label>difficulty</Label></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((w) => {
                  const isToday = w.date === today;
                  const past = w.date < today;
                  return (
                    <tr key={w.id} className={TR} style={isToday ? { boxShadow: 'inset 3px 0 0 0 var(--accent)' } : undefined}>
                      <td className={`${TD} font-mono tabular ${past ? 'text-text-tertiary' : 'text-text-secondary'} ${isToday ? 'pl-3' : ''}`}>
                        {w.date}
                        {isToday && <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-text-primary">today</span>}
                      </td>
                      <td className={TD}>
                        <MiniTiles
                          word={w.word}
                          states={Array(w.word.length).fill(past ? 'absent' : 'correct')}
                          size={22}
                          gap={2}
                        />
                      </td>
                      <td className={`${TD} text-right font-mono text-xs tabular text-text-secondary`}>
                        {w.difficulty != null ? `${w.difficulty} · ${difficultyLabel(w.difficulty)}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Reveal>
      </div>
    </AdminPage>
  );
}
