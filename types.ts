
export type GameStatus = 'waiting' | 'playing' | 'finished';

export interface Player {
  uid: string;
  name: string;
  photoURL: string | null;
  board: number[][];
  lines: number;
  isReady: boolean;
}

export interface Room {
  id: string;
  name: string;
  hostId: string;
  status: GameStatus;
  players: Record<string, Player>;
  currentTurn: string;
  pickedNumbers: number[];
  winner: string | null;
  createdAt: number;
}

export interface UserInfo {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}
