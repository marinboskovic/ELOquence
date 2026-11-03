import type { Module } from '../_components/challenges/types';
import { MODULE_1 } from './m1';
import { MODULE_2 } from './m2';
import { MODULE_3 } from './m3';
import { MODULE_4 } from './m4';
import { MODULE_5 } from './m5';
import { MODULE_6 } from './m6';
import { MODULE_7 } from './m7';

export const MODULES: Module[] = [
  MODULE_1,
  MODULE_2,
  MODULE_3,
  MODULE_4,
  MODULE_5,
  MODULE_6,
  MODULE_7,
];

export const TOTAL_LESSONS = MODULES.reduce((n, m) => n + m.lessons.length, 0);

export const LESSON_ORDER: string[] = MODULES.flatMap((m) =>
  m.lessons.map((l) => l.id),
);

export function findLesson(lessonId: string) {
  for (const m of MODULES) {
    const l = m.lessons.find((x) => x.id === lessonId);
    if (l) return { module: m, lesson: l };
  }
  return null;
}
