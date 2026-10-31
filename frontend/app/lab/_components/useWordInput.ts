'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Shared typing state for the Lab's 5-tile input rows: letters, backspace,
 * a one-shot shake flag and a transient inline message — the same feel as
 * the game page without the game.
 */
export function useWordInput() {
  const [word, setWord] = useState('');
  const [shaking, setShaking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    []
  );

  const shake = useCallback((message?: string) => {
    setShaking(true);
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => setShaking(false), 480);
    if (message) {
      setNotice(message);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setNotice(null), 2200);
    }
  }, []);

  const onKey = useCallback((key: string) => {
    setWord((w) => (w.length >= 5 ? w : w + key.toUpperCase()));
  }, []);

  const onBackspace = useCallback(() => {
    setWord((w) => w.slice(0, -1));
  }, []);

  const clear = useCallback(() => setWord(''), []);

  return { word, setWord, clear, onKey, onBackspace, shaking, shake, notice };
}
