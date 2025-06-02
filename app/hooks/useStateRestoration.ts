import { useState, useRef, useCallback } from 'react';
import type { SeatKey } from './useGameState';
import type { GameLogEntry } from './useGameConnection';

export interface StateRestorationHookReturn {
  lastKnownSeat: SeatKey | null;
  lastKnownReadyState: boolean;
  
  // Functions
  storePlayerState: (seat: SeatKey | null, ready: boolean) => void;
  attemptStateRestoration: (
    getCurrentPlayerSeat: () => SeatKey | null,
    getPlayerReady: (seat: SeatKey) => boolean,
    sendMessage: (message: any) => void,
    addLogEntry: (entry: GameLogEntry) => void,
    playerId: string
  ) => void;
  clearStoredState: () => void;
}

export function useStateRestoration(): StateRestorationHookReturn {
  const [lastKnownSeat, setLastKnownSeat] = useState<SeatKey | null>(null);
  const [lastKnownReadyState, setLastKnownReadyState] = useState(false);
  
  // Store current player state before disconnection
  const storePlayerState = useCallback((seat: SeatKey | null, ready: boolean) => {
    if (seat) {
      setLastKnownSeat(seat);
      setLastKnownReadyState(ready);
    }
  }, []);
  
  // Clear stored state
  const clearStoredState = useCallback(() => {
    setLastKnownSeat(null);
    setLastKnownReadyState(false);
  }, []);
  
  // Attempt to restore player state after reconnection
  const attemptStateRestoration = useCallback((
    getCurrentPlayerSeat: () => SeatKey | null,
    getPlayerReady: (seat: SeatKey) => boolean,
    sendMessage: (message: any) => void,
    addLogEntry: (entry: GameLogEntry) => void,
    playerId: string
  ) => {
    if (!lastKnownSeat) {
      addLogEntry({
        type: 'system',
        message: 'No previous seat to restore'
      });
      return;
    }

    addLogEntry({
      type: 'system',
      message: `Checking if seat ${lastKnownSeat} is still available...`
    });

    // Wait a moment for the server to send us the current game state
    setTimeout(() => {
      const currentSeat = getCurrentPlayerSeat();
      
      if (currentSeat) {
        // We're already in a seat! Check if it's our previous seat
        if (currentSeat === lastKnownSeat) {
          addLogEntry({
            type: 'system',
            message: `Already in seat ${currentSeat} - checking ready state...`
          });
          
          // Check if we need to restore ready state
          const currentReady = getPlayerReady(currentSeat);
          if (lastKnownReadyState && !currentReady) {
            setTimeout(() => {
              sendMessage({
                type: "ready",
                player_id: playerId
              });
              
              addLogEntry({
                type: 'system',
                message: 'Restoring ready state...'
              });
            }, 500);
          } else {
            addLogEntry({
              type: 'system',
              message: `State fully restored! (seat: ${currentSeat}, ready: ${currentReady})`
            });
          }
        } else {
          addLogEntry({
            type: 'system',
            message: `Found in different seat ${currentSeat} (was ${lastKnownSeat})`
          });
        }
      } else {
        // We're not in any seat, try to take our previous one
        addLogEntry({
          type: 'system',
          message: `Not in any seat - attempting to retake ${lastKnownSeat}...`
        });
        
        sendMessage({
          type: "take_seat",
          seat: lastKnownSeat
        });

        // If we were ready before, try to ready up after taking the seat
        if (lastKnownReadyState) {
          setTimeout(() => {
            sendMessage({
              type: "ready",
              player_id: playerId
            });
            
            addLogEntry({
              type: 'system',
              message: 'Attempting to restore ready state...'
            });
          }, 1000);
        }
      }
    }, 1000); // Wait 1 second for game state updates
  }, [lastKnownSeat, lastKnownReadyState]);
  
  return {
    lastKnownSeat,
    lastKnownReadyState,
    storePlayerState,
    attemptStateRestoration,
    clearStoredState
  };
} 