'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/lib/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { Button, Label, Reveal, Tag } from '@/components/ui';
import { AdminLoading, AdminPage, EmptyBand, ErrorBand, Field, PanelHead, PanelLoading } from '../_shared';

interface Announcement {
  id: string;
  text: string;
  active: boolean;
  created_at: string;
}

/** Same 40×22 square-knob switch as Settings. */
function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={clsx(
        'relative shrink-0 w-10 h-[22px] border-2 transition-colors duration-fast disabled:opacity-40 disabled:cursor-not-allowed',
        checked ? 'bg-accent border-accent' : 'bg-transparent border-border-default'
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          'absolute top-[2px] left-[2px] w-[14px] h-[14px] transition-transform duration-fast ease-out',
          checked ? 'translate-x-[18px] bg-accent-ink' : 'translate-x-0 bg-border-default'
        )}
      />
    </button>
  );
}

export default function AdminAnnouncementsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  // Create form
  const [newText, setNewText] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Action tracking
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchAnnouncements = () => {
    adminApi
      .announcements()
      .then((res) => setAnnouncements(res.data))
      .catch(() => setError('Failed to load announcements.'))
      .finally(() => setFetching(false));
  };

  useEffect(() => {
    if (loading) return;
    if (!user || !user.is_admin) {
      router.replace('/play');
      return;
    }
    fetchAnnouncements();
  }, [user, loading, router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    const text = newText.trim();
    if (!text) {
      setCreateError('Announcement text is required.');
      return;
    }
    setCreating(true);
    try {
      await adminApi.createAnnouncement(text);
      setNewText('');
      fetchAnnouncements();
    } catch {
      setCreateError('Failed to create announcement.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    setToggling(id);
    try {
      await adminApi.updateAnnouncement(id, { active: !currentActive });
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, active: !currentActive } : a))
      );
    } catch {
      setError('Failed to toggle announcement.');
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    setDeleting(id);
    setConfirmDelete(null);
    try {
      await adminApi.deleteAnnouncement(id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setError('Failed to delete announcement.');
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  if (loading) return <AdminLoading />;

  if (!user?.is_admin) return null;

  const activeCount = announcements.filter((a) => a.active).length;

  return (
    <AdminPage eyebrow={`admin · announcements · ${activeCount} live`} title="Announcements">
      {error && <ErrorBand onDismiss={() => setError('')}>{error}</ErrorBand>}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12">
        {/* ── Compose: 5 cols with a live preview of the banner strip ── */}
        <Reveal as="section" className="md:col-span-5">
          <PanelHead title="New announcement" />
          <form onSubmit={handleCreate} className="flex flex-col gap-6">
            <div className="bg-wash-ochre border-b border-border-subtle h-9 flex items-center gap-4 px-4" aria-hidden="true">
              <Label className="text-text-primary shrink-0">notice</Label>
              <span className={clsx('flex-1 min-w-0 truncate text-sm', newText ? 'text-text-primary' : 'text-text-tertiary')}>
                {newText || 'Your text, as players will see it under the nav.'}
              </span>
            </div>
            <Field label="text">
              <textarea
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                rows={3}
                placeholder="Short, declarative. One line reads best."
                className="w-full border-0 border-b-2 border-border-default focus:border-accent bg-transparent px-0 py-2.5 text-sm text-text-primary placeholder:text-text-ghost outline-none transition-colors duration-fast resize-none"
              />
            </Field>
            {createError && <p className="text-sm text-accent" role="alert">{createError}</p>}
            <Button type="submit" size="lg" className="w-full" loading={creating}>
              Post announcement
            </Button>
          </form>
        </Reveal>

        {/* ── List: 7 cols ── */}
        <Reveal as="section" delay={0.05} className="md:col-span-7">
          <PanelHead title="All announcements" aside={`${announcements.length} total`} />
          {fetching ? (
            <PanelLoading label="Loading announcements" rows={4} />
          ) : announcements.length === 0 ? (
            <EmptyBand>No announcements yet.</EmptyBand>
          ) : (
            <ul>
              <AnimatePresence initial={false}>
                {announcements.map((a) => (
                  <motion.li
                    key={a.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="py-4 border-b border-border-subtle flex items-start gap-4 hover:bg-bg-elevated transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className={clsx('text-sm leading-relaxed', a.active ? 'text-text-primary' : 'text-text-secondary')}>{a.text}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          {a.active ? <Tag tone="green" dot="var(--accent)">live</Tag> : <Tag>off</Tag>}
                          <span className="font-mono text-[11px] text-text-tertiary tabular">{formatDate(a.created_at)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Toggle
                          checked={a.active}
                          onChange={() => handleToggle(a.id, a.active)}
                          label={a.active ? 'Deactivate' : 'Activate'}
                          disabled={toggling === a.id}
                        />
                        <Button
                          type="button"
                          variant={confirmDelete === a.id ? 'danger' : 'ghost'}
                          size="sm"
                          onClick={() => handleDelete(a.id)}
                          loading={deleting === a.id}
                          aria-label={confirmDelete === a.id ? 'Confirm delete' : 'Delete'}
                        >
                          {confirmDelete === a.id ? 'Confirm?' : <Trash2 size={14} />}
                        </Button>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </Reveal>
      </div>
    </AdminPage>
  );
}
