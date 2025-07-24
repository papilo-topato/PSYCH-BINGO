
export type GameState = 'SETUP' | 'PLAYING' | 'GAME_OVER';
export type Player = 'USER' | 'COMPUTER';
export type Winner = Player | 'DRAW' | null;
export type Board = (number | null)[];
export type Marks = boolean[];