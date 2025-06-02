import { useState, useRef, useEffect, useCallback } from 'react';
import { Chess } from 'chess.js';

// Game phase types
export const GamePhase = {
  SETUP: 'setup',
  TEAM1_SELECTION: 'team1_selection',
  TEAM1_COMPUTING: 'team1_computing',
  TEAM2_SELECTION: 'team2_selection',
  TEAM2_COMPUTING: 'team2_computing',
  COOLDOWN: 'cooldown'
} as const;

export const GamePhaseNames = {
  [GamePhase.SETUP]: 'Setup',
  [GamePhase.TEAM1_SELECTION]: 'White Selection',
  [GamePhase.TEAM1_COMPUTING]: 'White Computing',
  [GamePhase.TEAM2_SELECTION]: 'Black Selection',
  [GamePhase.TEAM2_COMPUTING]: 'Black Computing',
  [GamePhase.COOLDOWN]: 'Cooldown'
} as const;

export type GamePhaseType = typeof GamePhase[keyof typeof GamePhase];
export type SeatKey = 't1p1' | 't1p2' | 't2p1' | 't2p2';
export type TeamNumber = 1 | 2;
export type Orientation = 'white' | 'black';

export interface Player {
  id: string | null;
  ready: boolean;
}

export interface Players {
  t1p1: Player;
  t1p2: Player;
  t2p1: Player;
  t2p2: Player;
}

export interface GameStateHookReturn {
  // Chess state
  chess: Chess;
  fen: string;
  orientation: Orientation;
  
  // Game state
  gamePhase: GamePhaseType;
  timeRemaining: number;
  timeRemainingKey: string | null;
  
  // Player state
  players: Players;
  playerTeam: TeamNumber | null;
  selectedMove: boolean;
  lockedIn: boolean;
  
  // Shapes for board visualization
  shapes: Array<{ orig: string; dest: string; brush: string }>;
  
  // Actions
  setChessPosition: (fen: string) => void;
  setGamePhase: (phase: GamePhaseType) => void;
  setTimeRemaining: (time: number, key?: string | null) => void;
  updatePlayers: (updates: Partial<Players>) => void;
  setSelectedMove: (selected: boolean) => void;
  setLockedIn: (locked: boolean) => void;
  setShapes: (shapes: Array<{ orig: string; dest: string; brush: string }>) => void;
  
  // Helper functions
  getCurrentPlayerSeat: () => SeatKey | null;
  isPlayerReady: () => boolean;
  canTakeSeat: (seat: SeatKey) => boolean;
  
  // Player management
  takeSeat: (seat: SeatKey, playerId: string) => void;
  setPlayerReady: (seat: SeatKey, ready: boolean) => void;
}

interface UseGameStateOptions {
  playerId: string;
  initialFen?: string;
}

export function useGameState({ playerId, initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' }: UseGameStateOptions): GameStateHookReturn {
  // Chess state
  const [chess, setChess] = useState(() => new Chess(initialFen));
  const [fen, setFen] = useState(initialFen);
  const [orientation, setOrientation] = useState<Orientation>('white');
  
  // Game state
  const [gamePhase, setGamePhase] = useState<GamePhaseType>(GamePhase.COOLDOWN);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timeRemainingKey, setTimeRemainingKey] = useState<string | null>(null);
  
  // Player state
  const [players, setPlayers] = useState<Players>({
    t1p1: { id: null, ready: false },
    t1p2: { id: null, ready: false },
    t2p1: { id: null, ready: false },
    t2p2: { id: null, ready: false }
  });
  const [playerTeam, setPlayerTeam] = useState<TeamNumber | null>(null);
  const [selectedMove, setSelectedMove] = useState(false);
  const [lockedIn, setLockedIn] = useState(false);
  
  // Board visualization
  const [shapes, setShapes] = useState([{ orig: 'e0', dest: 'e0', brush: 'green' }]);
  
  // Refs for use in callbacks
  const playersRef = useRef(players);
  const playerIdRef = useRef(playerId);
  
  // Update refs when state changes
  useEffect(() => {
    playersRef.current = players;
  }, [players]);
  
  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);
  
  // Chess position setter
  const setChessPosition = useCallback((newFen: string) => {
    const newChess = new Chess(newFen);
    setChess(newChess);
    setFen(newFen);
  }, []);
  
  // Time setter with optional key
  const setTimeRemainingWithKey = useCallback((time: number, key?: string | null) => {
    setTimeRemaining(time);
    if (key !== undefined) {
      setTimeRemainingKey(key);
    }
  }, []);
  
  // Player updates
  const updatePlayers = useCallback((updates: Partial<Players>) => {
    setPlayers(prev => ({ ...prev, ...updates }));
  }, []);
  
  // Helper function to find current player's seat
  const getCurrentPlayerSeat = useCallback((): SeatKey | null => {
    const currentPlayers = playersRef.current;
    const seat = Object.entries(currentPlayers).find(
      ([_, player]) => player.id === playerIdRef.current
    )?.[0] as SeatKey | undefined;
    
    return seat || null;
  }, []);
  
  // Check if current player is ready
  const isPlayerReady = useCallback((): boolean => {
    const seat = getCurrentPlayerSeat();
    return seat ? playersRef.current[seat]?.ready || false : false;
  }, [getCurrentPlayerSeat]);
  
  // Check if player can take a specific seat
  const canTakeSeat = useCallback((seat: SeatKey): boolean => {
    const currentPlayers = playersRef.current;
    const currentSeat = getCurrentPlayerSeat();
    const currentPlayerReady = currentSeat ? currentPlayers[currentSeat]?.ready : false;
    
    // Can't change seats if already ready
    if (currentSeat && currentPlayerReady) {
      return false;
    }
    
    // Can take seat if it's empty or it's their own seat
    return currentPlayers[seat]?.id === null || currentPlayers[seat]?.id === playerIdRef.current;
  }, [getCurrentPlayerSeat]);
  
  // Take a seat
  const takeSeat = useCallback((seat: SeatKey, takingPlayerId: string) => {
    setPlayers(prev => {
      // First, remove player from any other seat
      const clearedPlayers = Object.fromEntries(
        Object.entries(prev).map(([seatKey, player]) => [
          seatKey,
          player.id === takingPlayerId ? { ...player, id: null } : player
        ])
      ) as Players;
      
      // Then assign to new seat
      return {
        ...clearedPlayers,
        [seat]: { ...clearedPlayers[seat], id: takingPlayerId }
      };
    });
    
    // Update player team and orientation if this is the current player
    if (takingPlayerId === playerIdRef.current) {
      if (seat.startsWith('t1')) {
        setPlayerTeam(1);
        setOrientation('white');
      } else if (seat.startsWith('t2')) {
        setPlayerTeam(2);
        setOrientation('black');
      }
    }
  }, []);
  
  // Set player ready status
  const setPlayerReady = useCallback((seat: SeatKey, ready: boolean) => {
    setPlayers(prev => ({
      ...prev,
      [seat]: { ...prev[seat], ready }
    }));
  }, []);
  
  return {
    // Chess state
    chess,
    fen,
    orientation,
    
    // Game state
    gamePhase,
    timeRemaining,
    timeRemainingKey,
    
    // Player state
    players,
    playerTeam,
    selectedMove,
    lockedIn,
    
    // Shapes
    shapes,
    
    // Actions
    setChessPosition,
    setGamePhase,
    setTimeRemaining: setTimeRemainingWithKey,
    updatePlayers,
    setSelectedMove,
    setLockedIn,
    setShapes,
    
    // Helper functions
    getCurrentPlayerSeat,
    isPlayerReady,
    canTakeSeat,
    
    // Player management
    takeSeat,
    setPlayerReady
  };
} 