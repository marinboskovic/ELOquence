'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, ChevronDown, Plus, Search } from 'lucide-react';
import { Button, Label, Reveal, SplitWords, Tag } from '@/components/ui';
import { CHAPTERS, type Chapter } from './_chapters';
import { SECTIONS, MiniSparkline, type FAQItem } from './_data';
import HelpTour from './_components/HelpTour';
import clsx from 'clsx';

/**
 * Help: six short chapters as a slide tour (the beginner path), and the full manual
 * folded away underneath for the people who want the maths.
 */

const READ_KEY = 'eloquence_help_read';

function useReadChapters(): [Set<string>, (slug: string) => void] {
  const [read, setRead] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(READ_KEY);
      if (raw) setRead(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* private mode — progress just is not remembered */
    }
  }, []);
  const mark = useCallback((slug: string) => {
    setRead((prev) => {
      if (prev.has(slug)) return prev;
      const next = new Set(prev).add(slug);
      try {
        localStorage.setItem(READ_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  return [read, mark];
}

/* ───────────── chapter list ───────────── */

function ChapterRow({ chapter, read, onOpen }: { chapter: Chapter; read: boolean; onOpen: () => void }) {
  return (
    <li className="rule-hair">
      <button
        type="button"
        onClick={onOpen}
        className="group w-full grid grid-cols-[3rem_1fr_auto] md:grid-cols-[4rem_1fr_auto_auto] items-center gap-4 md:gap-8 py-5 md:py-6 text-left transition-colors duration-fast hover:bg-bg-elevated -mx-2 px-2"
        aria-label={`${chapter.title}: ${chapter.blurb}`}
      >
        <span className="font-display font-black text-display-md tabular text-text-tertiary group-hover:text-text-primary transition-colors duration-fast">
          {chapter.number}
        </span>
        <span className="min-w-0">
          <span className="block font-display text-display-sm text-text-primary">
            <span className="ink-link">{chapter.title}</span>
          </span>
          <span className="block text-sm text-text-secondary mt-1 text-balance">{chapter.blurb}</span>
          <span className="mt-2 flex items-center gap-2 md:hidden">
            <span className="font-mono text-label uppercase text-text-tertiary">{chapter.slides.length} slides · ~1 min</span>
            {read && <Tag tone="green">read</Tag>}
          </span>
        </span>
        <span className="hidden md:flex items-center gap-3">
          {chapter.preview}
          <span className="font-mono text-label uppercase text-text-tertiary whitespace-nowrap">~1 min</span>
          {read ? (
            <Tag tone="green">
              <Check size={11} aria-hidden="true" /> read
            </Tag>
          ) : (
            <Tag tone="neutral">{chapter.slides.length} slides</Tag>
          )}
        </span>
        <ArrowRight size={18} className="text-text-tertiary group-hover:text-text-primary group-hover:translate-x-1 transition-[color,transform] duration-fast" aria-hidden="true" />
      </button>
    </li>
  );
}

/* ───────────── nerd corner (the full manual) ───────────── */

function ManualItem({ id, item, isOpen, onToggle }: { id: string; item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="rule-hair">
      <button onClick={onToggle} className="w-full flex items-start gap-4 py-4 text-left group" aria-expanded={isOpen} id={`faq-btn-${id}`} aria-controls={`faq-body-${id}`}>
        <h4 className="flex-1 font-sans text-base font-semibold text-text-primary leading-snug">
          <span className="ink-link">{item.q}</span>
        </h4>
        <span
          className={clsx('shrink-0 mt-0.5 transition-[transform,color] duration-med ease-ink', isOpen ? 'text-accent' : 'text-text-tertiary group-hover:text-text-primary')}
          style={{ transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}
          aria-hidden="true"
        >
          <Plus size={16} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={`faq-body-${id}`}
            role="region"
            aria-labelledby={`faq-btn-${id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-6 pr-6 md:pr-10">{item.a}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Manual() {
  const [query, setQuery] = useState('');
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const q = query.toLowerCase().trim();
  const sections = useMemo(() => {
    if (!q) return SECTIONS;
    return SECTIONS.map((s) => ({ ...s, items: s.items.filter((it) => it.q.toLowerCase().includes(q) || it.plain.toLowerCase().includes(q)) })).filter((s) => s.items.length > 0);
  }, [q]);

  // A search opens everything that matches; clearing it folds the manual back up.
  useEffect(() => {
    if (!q) return;
    setOpenSections(new Set(sections.map((s) => s.slug)));
    setOpenItems(new Set(sections.flatMap((s) => s.items.map((it) => `${s.slug}::${it.q}`))));
  }, [q, sections]);

  // Old deep links (#hardmode etc.) still land on their section, unfolded — on load and
  // when the hash changes while the page is already open.
  useEffect(() => {
    const openFromHash = () => {
      const slug = window.location.hash.replace('#', '');
      if (!slug || !SECTIONS.some((s) => s.slug === slug)) return;
      setOpenSections((prev) => new Set(prev).add(slug));
      window.setTimeout(() => document.getElementById(slug)?.scrollIntoView({ block: 'start' }), 50);
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, []);

  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) =>
    set((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const total = SECTIONS.reduce((n, s) => n + s.items.length, 0);

  return (
    <section id="manual" className="scroll-mt-24 mt-20 md:mt-28">
      <div className="rule-top pt-3 grid md:grid-cols-12 gap-6 md:gap-8 items-end">
        <div className="md:col-span-7">
          <Label className="block mb-1">nerd corner · {total} questions</Label>
          <h2 className="font-display text-display-md text-text-primary">The full manual</h2>
          <p className="text-sm md:text-base text-text-secondary mt-2 max-w-xl">
            How the engine thinks, the maths behind the scores, word lists, replays. Nobody needs this to play. Some people need it to sleep.
          </p>
        </div>
        <div className="md:col-span-5 relative border-b-2 border-border-default focus-within:border-accent transition-colors duration-fast">
          <Search size={14} className="absolute left-0 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the manual…"
            aria-label="Search the manual"
            className="w-full pl-6 pr-2 py-2 bg-transparent border-0 font-sans text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />
        </div>
      </div>

      {sections.length === 0 && (
        <div className="mt-8 bg-bg-ink text-text-on-ink px-6 py-8 flex flex-col gap-4 items-start">
          <p className="font-display text-display-sm">Nothing on &ldquo;{query}&rdquo;. The coach might know.</p>
          <Button variant="secondary" size="sm" className="border-text-on-ink text-text-on-ink" onClick={() => setQuery('')}>
            Clear search
          </Button>
        </div>
      )}

      <div className="mt-6">
        {sections.map((section) => {
          const open = openSections.has(section.slug);
          return (
            <div key={section.slug} id={section.slug} className="scroll-mt-24 rule-hair">
              <button
                type="button"
                onClick={() => toggle(setOpenSections, section.slug)}
                aria-expanded={open}
                className="w-full flex items-center gap-4 py-4 text-left group"
              >
                <span className="text-text-tertiary shrink-0" aria-hidden="true">
                  {section.icon}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="font-display text-display-sm text-text-primary">
                    <span className="ink-link">{section.title}</span>
                  </span>
                  <span className="block sm:inline sm:ml-3 mt-0.5 sm:mt-0 font-mono text-label uppercase text-text-tertiary">
                    {section.items.length} {section.items.length === 1 ? 'question' : 'questions'}
                  </span>
                </span>
                <ChevronDown size={16} className={clsx('shrink-0 text-text-tertiary transition-transform duration-med ease-ink', open && 'rotate-180')} aria-hidden="true" />
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }} className="overflow-hidden">
                    <div className="pl-0 md:pl-8 pb-4">
                      {section.intro && <p className="text-sm text-text-secondary max-w-2xl mb-2">{section.intro}</p>}
                      {section.items.map((item) => {
                        const id = `${section.slug}::${item.q}`;
                        return <ManualItem key={id} id={id} item={item} isOpen={openItems.has(id)} onToggle={() => toggle(setOpenItems, id)} />;
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ───────────── page ───────────── */

export default function HelpPage() {
  const [active, setActive] = useState<Chapter | null>(null);
  const [read, markRead] = useReadChapters();

  const openChapter = (c: Chapter) => {
    setActive(c);
    markRead(c.slug);
  };
  const nextOf = (c: Chapter | null) => (c ? CHAPTERS[CHAPTERS.indexOf(c) + 1] ?? null : null);
  const allRead = CHAPTERS.every((c) => read.has(c.slug));

  return (
    <div className="min-h-page bg-bg-base">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-16">
        <header className="grid md:grid-cols-12 gap-6 md:gap-8 mb-10 md:mb-14">
          <div className="md:col-span-7">
            <Label className="block mb-3">help · six chapters · about a minute each</Label>
            <SplitWords text="Start here." as="h1" className="font-display text-display-lg text-text-primary" />
          </div>
          <Reveal delay={0.2} className="md:col-span-5 md:pt-8 flex flex-col gap-4">
            <p className="font-sans text-sm md:text-base text-text-secondary leading-relaxed">
              Everything you need to play well, in six short chapters with pictures. No homework. The full manual is at the bottom
              for when you want to know why.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <Button size="sm" onClick={() => openChapter(CHAPTERS[0])}>
                Start the tour
                <ArrowRight size={13} />
              </Button>
              <a href="#manual" className="ink-link font-mono text-label uppercase text-text-secondary">
                skip to the manual
              </a>
            </div>
          </Reveal>
        </header>

        <Reveal delay={0.1}>
          <ol className="border-b border-border-subtle">
            {CHAPTERS.map((c) => (
              <ChapterRow key={c.slug} chapter={c} read={read.has(c.slug)} onOpen={() => openChapter(c)} />
            ))}
          </ol>
          <p className="mt-4 font-mono text-label uppercase text-text-tertiary" aria-live="polite">
            {allRead ? 'six of six. you are now mildly dangerous.' : `${read.size} of ${CHAPTERS.length} read · the order does not matter, we just numbered them`}
          </p>
        </Reveal>

        <Manual />

        <div className="mt-16 md:mt-20 mb-4 rule-top pt-5 grid md:grid-cols-12 gap-4 items-start">
          <div className="md:col-span-4">
            <MiniSparkline />
          </div>
          <div className="md:col-span-8">
            <p className="font-display text-display-sm text-text-primary">Made by Marin Bošković</p>
            <p className="font-sans text-sm text-text-secondary mt-2 leading-relaxed">
              ELOquence is a personal project. Found a bug, or a joke that is not funny? The feedback option in your account menu reaches me.
            </p>
          </div>
        </div>
      </div>

      <HelpTour chapter={active} next={nextOf(active)} onClose={() => setActive(null)} onNext={openChapter} />
    </div>
  );
}
