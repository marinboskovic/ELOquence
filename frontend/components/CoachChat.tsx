'use client';
import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
import { aiApi } from '@/lib/api';
import { Label } from '@/components/ui';
import clsx from 'clsx';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  gameId: string;
  /** Plain one-line summary of the game shown above the chat, e.g. "CRANE · Solved in 3 · Ranked". */
  gameContext: string;
  /** Suggested questions in plain words; the page can tailor them to the game. */
  suggestions?: string[];
  /** Focus the input on mount — only when the chat opens in its own panel. */
  autoFocus?: boolean;
}

const MAX_MESSAGES = 10;

const DEFAULT_SUGGESTIONS = [
  'Which guess cost me the most?',
  'What should I open with next time?',
  'How do I make better use of yellow letters?',
];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1" aria-label="Coach is typing">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block w-1.5 h-1.5 bg-text-primary"
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

export default function CoachChat({ gameId, gameContext, suggestions, autoFocus = false }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [msgCount, setMsgCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount — opt-in, so an inline chat never scrolls the page on load
  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [autoFocus]);

  // Scroll the message list (not the page) to the bottom when messages change
  useEffect(() => {
    if (messages.length === 0 && !sending) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, sending]);

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || sending || msgCount >= MAX_MESSAGES) return;

    setInput('');
    const userMsg: Message = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    setMsgCount((c) => c + 1);

    try {
      const res = await aiApi.coachChat(gameId, trimmed, messages);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.data.response }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I could not answer that. Please try again.',
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function fillSuggestion(q: string) {
    setInput(q);
    inputRef.current?.focus();
  }

  const limitReached = msgCount >= MAX_MESSAGES;
  const prompts = suggestions && suggestions.length > 0 ? suggestions : DEFAULT_SUGGESTIONS;

  return (
    <div className="w-full h-full flex flex-col bg-bg-elevated">
      {/* Game context line */}
      {gameContext && (
        <div className="px-4 pt-3 pb-2 shrink-0 border-b border-border-subtle">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">{gameContext}</span>
        </div>
      )}

      {/* Messages area */}
      <div ref={scrollRef} className="flex flex-col overflow-y-auto px-4 flex-1 min-h-0">
        {messages.length === 0 && !sending && (
          <div className="flex flex-col gap-3 py-4">
            <p className="font-display text-display-sm text-text-primary">Ask anything about this game.</p>
            <Label>try one of these</Label>
            <div className="flex flex-col">
              {prompts.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => fillSuggestion(q)}
                  className="rule-hair py-2.5 text-left font-sans text-sm text-text-secondary hover:text-text-primary hover:bg-bg-base transition-colors duration-fast cursor-pointer"
                >
                  <span className="ink-link">{q}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={clsx('rule-hair py-3 flex flex-col gap-1', msg.role === 'user' ? 'items-end text-right' : 'items-start')}
          >
            {msg.role === 'user' ? (
              <Label className="text-text-tertiary">you</Label>
            ) : (
              <span className="font-display font-bold text-sm text-text-primary">Coach</span>
            )}
            <p className={clsx('font-sans text-sm leading-relaxed text-text-primary max-w-[92%]', msg.role === 'user' && 'text-text-secondary')}>
              {msg.content}
            </p>
          </motion.div>
        ))}

        {sending && (
          <div className="rule-hair py-3 flex flex-col gap-1">
            <span className="font-display font-bold text-sm text-text-primary">Coach</span>
            <TypingIndicator />
          </div>
        )}
      </div>

      {/* Input area: underline style */}
      <div className="px-4 py-3 shrink-0 rule-top">
        {limitReached ? (
          <p className="font-mono text-label uppercase text-text-tertiary py-2">
            that&rsquo;s all for this game · {MAX_MESSAGES} of {MAX_MESSAGES} questions used
          </p>
        ) : (
          <div className="flex items-end gap-2 border-b-2 border-border-default focus-within:border-accent transition-colors duration-fast">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this game…"
              aria-label="Ask the coach"
              disabled={sending}
              className="flex-1 bg-transparent border-0 py-2 font-sans text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="w-8 h-8 mb-1 inline-flex items-center justify-center bg-bg-ink text-text-on-ink disabled:opacity-30 transition-opacity duration-fast shrink-0"
              aria-label="Send question"
            >
              <ArrowUp size={14} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
