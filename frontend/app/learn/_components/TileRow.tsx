/**
 * Shared tile-state type for the learn challenges. The old `Tile` / `TileRow`
 * components that lived here had no importers; challenges render their own
 * tiles from `./challenges/Tile.tsx`.
 */
export type TileState = 'correct' | 'present' | 'absent' | 'empty';
