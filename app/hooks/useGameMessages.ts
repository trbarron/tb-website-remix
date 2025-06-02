import { useCallback } from 'react';
import { Chess } from 'chess.js';
import type { GameMessage, GameLogEntry } from './useGameConnection';
import type { SeatKey, GamePhaseType, Players } from './useGameState';
import { GamePhaseNames } from './useGameState';

export interface GameMessageHandlerOptions {
  playerId: string;
  
  // State setters from game state hook
  setChessPosition: (fen: string) => void;
  setGamePhase: (phase: GamePhaseType) => void;
  setTimeRemaining: (time: number, key?: string | null) => void;
  updatePlayers: (updates: Partial<Players>) => void;
  setShapes: (shapes: Array<{ orig: string; dest: string; brush: string }>) => void;
  setSelectedMove: (selected: boolean) => void;
  setLockedIn: (locked: boolean) => void;
  
  // Helper functions from game state hook
  takeSeat: (seat: SeatKey, playerId: string) => void;
  setPlayerReady: (seat: SeatKey, ready: boolean) => void;
  getCurrentPlayerSeat: () => SeatKey | null;
  
  // From connection hook
  addLogEntry: (entry: GameLogEntry) => void;
  
  // From state restoration hook
  storePlayerState: (seat: SeatKey | null, ready: boolean) => void;
  
  // Current state (via refs or direct access)
  getCurrentPlayers: () => Players;
}

export interface GameMessageHandlerHookReturn {
  handleMessage: (data: GameMessage) => void;
}

export function useGameMessages(options: GameMessageHandlerOptions): GameMessageHandlerHookReturn {
  const {
    playerId,
    setChessPosition,
    setGamePhase,
    setTimeRemaining,
    updatePlayers,
    setShapes,
    setSelectedMove,
    setLockedIn,
    takeSeat,
    setPlayerReady,
    getCurrentPlayerSeat,
    addLogEntry,
    storePlayerState,
    getCurrentPlayers
  } = options;

  const handleMessage = useCallback((data: GameMessage) => {
    console.log(`Processing message: ${data.type}`);
    
    switch (data.type) {
      case 'connection_established':
        break;

      case 'move_submitted':
        addLogEntry({
          type: 'move',
          message: `${data.player_id} submitted a move`,
          player: ''
        });
        break;

      case 'player_ready':
        const currentPlayers = getCurrentPlayers();
        const seatKey = Object.keys(currentPlayers).find(key =>
          currentPlayers[key as SeatKey].id === data.player_id
        ) as SeatKey | undefined;

        if (seatKey) {
          setPlayerReady(seatKey, true);

          // Store our own state when we become ready
          if (data.player_id === playerId) {
            const currentSeat = getCurrentPlayerSeat();
            if (currentSeat) {
              storePlayerState(currentSeat, true);
            }
            addLogEntry({
              type: 'system',
              message: 'You are now ready. You cannot change seats until the game ends.'
            });
          } else {
            addLogEntry({
              type: 'system',
              message: `${data.player_id} is ready`
            });
          }
        } else {
          addLogEntry({
            type: 'system',
            message: `${data.player_id} is ready`
          });
        }
        break;

      case 'game_state_update':
        // Update game phase if included
        if (data.game_phase) {
          setGamePhase(data.game_phase);
          addLogEntry({
            type: 'phase',
            message: `Phase: ${GamePhaseNames[data.game_phase as GamePhaseType]}`
          });
        }

        // Update duration/time if included
        if (data.duration !== undefined) {
          setTimeRemaining(data.duration);
        }

        // Update chess position if FEN is included
        if (data.fen) {
          setChessPosition(data.fen);
          setShapes([{ orig: 'e0', dest: 'e0', brush: 'green' }]);
          setSelectedMove(false);
          setLockedIn(false);
        }

        // Handle last move visualization
        if (data.last_move) {
          const move = data.last_move;
          const from = move.substring(0, 2);
          const to = move.substring(2, 4);
          setShapes([{
            orig: from,
            dest: to,
            brush: 'yellow'
          }]);
        }

        // Handle player seat/ready status updates
        const seatUpdates: Partial<Players> = {};
        const currentPlayersForUpdate = getCurrentPlayers();
        
        (['t1p1', 't1p2', 't2p1', 't2p2'] as SeatKey[]).forEach(seat => {
          if (data[`${seat}_seat`] !== undefined || data[`${seat}_ready`] !== undefined) {
            const seatId = data[`${seat}_seat`];
            seatUpdates[seat] = {
              id: seatId === "" ? null : (seatId ?? currentPlayersForUpdate[seat].id),
              ready: data[`${seat}_ready`] === 'true' || false
            };
          }
        });

        if (Object.keys(seatUpdates).length > 0) {
          updatePlayers(seatUpdates);

          // Check if current player took a seat and store state
          for (const [seat, info] of Object.entries(seatUpdates)) {
            if (info?.id === playerId) {
              storePlayerState(seat as SeatKey, info.ready || false);
              break;
            }
          }

          addLogEntry({
            type: 'system',
            message: 'Player seats updated'
          });
        }
        break;

      case 'timer_update':
        if (data.seconds_remaining !== undefined && data.seconds_remaining !== null) {
          const newTime = parseFloat(data.seconds_remaining);
          setTimeRemaining(newTime, data.key);
        }
        break;

      case 'move_selected':
        const moveText = `${data.move.from} to ${data.move.to}`;
        addLogEntry({
          type: 'engine',
          message: `Engine selected move: ${moveText} (by ${data.move.submitted_by})`
        });

        // Reset selections for next turn
        setSelectedMove(false);
        setLockedIn(false);
        break;

      case 'player_disconnected':
        const currentPlayersForDisconnect = getCurrentPlayers();
        const disconnectedSeatKey = Object.keys(currentPlayersForDisconnect).find(key =>
          currentPlayersForDisconnect[key as SeatKey].id === data.player_id
        ) as SeatKey | undefined;

        if (disconnectedSeatKey) {
          setPlayerReady(disconnectedSeatKey, false);
        }

        addLogEntry({
          type: 'system',
          message: `${data.player_id} disconnected`
        });
        break;

      case 'game_over':
        addLogEntry({
          type: 'game_over',
          message: data.message || `Game Over! ${data.result}`
        });

        // Add additional game details if available
        if (data.total_moves) {
          addLogEntry({
            type: 'system',
            message: `Total moves: ${data.total_moves}`
          });
        }

        if (data.team_coordination) {
          addLogEntry({
            type: 'system',
            message: `Team coordination - Team 1: ${data.team_coordination.team1_same_moves}, Team 2: ${data.team_coordination.team2_same_moves}`
          });
        }

        // Update chess position to final position
        if (data.final_position) {
          setChessPosition(data.final_position);
        }
        break;

      default:
        console.log(`Unknown message type: ${data.type}`);
    }
  }, [
    playerId,
    setChessPosition,
    setGamePhase,
    setTimeRemaining,
    updatePlayers,
    setShapes,
    setSelectedMove,
    setLockedIn,
    takeSeat,
    setPlayerReady,
    getCurrentPlayerSeat,
    addLogEntry,
    storePlayerState,
    getCurrentPlayers
  ]);

  return {
    handleMessage
  };
} 