"""Opener Lab — interactive exploration of the information-theory engine.

Two pure functions backed by the pre-computed pattern matrix:

* :func:`opener_report` — everything about one word as an *opening* guess:
  entropy, expected remaining answers, rank among every legal guess, the
  distribution of feedback patterns it can produce and the best openers for
  comparison.
* :func:`position_report` — given a sequence of (guess, pattern) pairs, the
  answers still possible and the best next guesses. This is the same engine
  the post-game review uses, exposed as a sandbox.

Both are CPU-bound numpy work (tens of milliseconds); routers call them via
``asyncio.to_thread``.
"""
from __future__ import annotations

import threading

import numpy as np

from app.analysis import engine
from app.services.word_difficulty import word_to_elo

_LOCK = threading.Lock()
_OPENER_TABLE: dict[str, np.ndarray] | None = None  # entropy / expected per ALL_WORDS index
_OPENER_RANK: np.ndarray | None = None  # rank (1 = best) per ALL_WORDS index


def _ensure_opener_table() -> None:
    """Entropy + expected-remaining of every legal guess as an opener,
    against the standard answer pool. Computed once (~1s) and cached."""
    global _OPENER_TABLE, _OPENER_RANK
    if _OPENER_TABLE is not None:
        return
    with _LOCK:
        if _OPENER_TABLE is not None:
            return
        all_possible = np.arange(len(engine.ANSWERS), dtype=np.int32)
        all_indices = np.arange(len(engine.ALL_WORDS), dtype=np.int32)
        entropy, expected, _bins, worst = engine._batch_metrics(all_indices, all_possible)
        order = np.argsort(-entropy, kind="stable")
        rank = np.empty(len(order), dtype=np.int32)
        rank[order] = np.arange(1, len(order) + 1)
        _OPENER_TABLE = {"entropy": entropy, "expected": expected, "worst": worst}
        _OPENER_RANK = rank


def reset_cache() -> None:
    """Test helper."""
    global _OPENER_TABLE, _OPENER_RANK
    _OPENER_TABLE = None
    _OPENER_RANK = None


def _pattern_buckets(guess_idx: int, possible: np.ndarray, top: int = 12) -> list[dict]:
    patterns = engine.PATTERN_MATRIX[guess_idx, possible]
    counts = np.bincount(patterns, minlength=243)
    total = int(len(possible))
    order = np.argsort(-counts, kind="stable")
    out = []
    for p in order[:top]:
        c = int(counts[p])
        if c == 0:
            break
        members = possible[patterns == p]
        out.append(
            {
                "pattern": int(p),
                "count": c,
                "probability": round(c / total, 4) if total else 0.0,
                "examples": [engine.ANSWERS[i] if i < len(engine.ANSWERS) else engine.COMPETITIVE_ANSWERS[i] for i in members[:6]],
            }
        )
    return out


def _word_facts(word: str) -> dict:
    vowels = sum(1 for ch in word if ch in "AEIOU")
    return {
        "unique_letters": len(set(word)),
        "vowels": vowels,
        "repeated_letters": len(word) - len(set(word)),
        "difficulty_elo": round(word_to_elo(word)),
        "is_possible_answer": word in engine.ANSWERS,
    }


def opener_report(word: str, top_n: int = 10) -> dict:
    """Full opener analysis for *word* (uppercase, must be a legal guess)."""
    _ensure_opener_table()
    assert _OPENER_TABLE is not None and _OPENER_RANK is not None
    idx = engine.get_word_index(word)
    n_total = len(engine.ALL_WORDS)
    n_answers = len(engine.ANSWERS)
    all_possible = np.arange(n_answers, dtype=np.int32)

    entropy = float(_OPENER_TABLE["entropy"][idx])
    expected = float(_OPENER_TABLE["expected"][idx])
    worst = int(_OPENER_TABLE["worst"][idx])
    rank = int(_OPENER_RANK[idx])
    best_entropy = float(_OPENER_TABLE["entropy"].max())

    order = np.argsort(-_OPENER_TABLE["entropy"], kind="stable")
    best = [
        {
            "word": engine.ALL_WORDS[i],
            "entropy": round(float(_OPENER_TABLE["entropy"][i]), 3),
            "expected_remaining": round(float(_OPENER_TABLE["expected"][i]), 1),
            "rank": int(_OPENER_RANK[i]),
            "is_possible_answer": engine.ALL_WORDS[i] in engine.ANSWERS,
        }
        for i in order[:top_n]
    ]

    # Neighbours: a few words ranked just above/below, so "rank 1,204" means
    # something concrete.
    pos = int(np.where(order == idx)[0][0])
    neighbours = [
        {
            "word": engine.ALL_WORDS[i],
            "entropy": round(float(_OPENER_TABLE["entropy"][i]), 3),
            "rank": int(_OPENER_RANK[i]),
        }
        for i in order[max(0, pos - 2) : pos + 3]
    ]

    return {
        "word": word,
        "entropy": round(entropy, 3),
        "best_entropy": round(best_entropy, 3),
        "efficiency": round(entropy / best_entropy, 4) if best_entropy else 0.0,
        "expected_remaining": round(expected, 1),
        "worst_case_remaining": worst,
        "rank": rank,
        "total_guesses": n_total,
        "percentile": round(100.0 * (1 - (rank - 1) / n_total), 1),
        "answers_total": n_answers,
        "pattern_buckets": _pattern_buckets(idx, all_possible),
        "distinct_patterns": int(len(np.unique(engine.PATTERN_MATRIX[idx, all_possible]))),
        "best_openers": best,
        "neighbours": neighbours,
        "facts": _word_facts(word),
    }


def position_report(guesses: list[str], patterns: list[int], top_n: int = 10, max_list: int = 60) -> dict:
    """Answers still possible after the given (guess, pattern) history and
    the best next guesses according to the engine."""
    possible = np.arange(len(engine.ANSWERS), dtype=np.int32)
    history = []
    for g, p in zip(guesses, patterns, strict=False):
        before = int(len(possible))
        possible = engine.get_remaining_answers(possible, g, p)
        history.append({"guess": g, "pattern": p, "remaining_before": before, "remaining_after": int(len(possible))})

    n = int(len(possible))
    picks = engine.find_optimal_guess(possible, n, top_n=top_n) if n > 0 else []
    remaining_words = [engine.ANSWERS[i] for i in possible[:max_list]]
    return {
        "history": history,
        "remaining": n,
        "remaining_words": remaining_words,
        "remaining_truncated": n > max_list,
        "entropy_left": round(float(np.log2(n)), 3) if n > 0 else 0.0,
        "top_picks": [
            {
                "word": p["word"],
                "entropy": round(float(p.get("entropy", 0.0)), 3),
                "expected_remaining": round(float(p.get("expected_remaining", 0.0)), 2),
                "is_possible_answer": bool(p.get("is_answer", False)),
                "worst_case_remaining": int(p.get("minimax", 0)),
            }
            for p in picks
        ],
        "solved": n == 1 and bool(patterns) and patterns[-1] == 242,
    }
