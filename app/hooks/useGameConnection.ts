import { useState, useRef, useEffect, useCallback } from 'react';

// Types for the hook
export interface GameLogEntry {
  type: 'system' | 'move' | 'engine' | 'phase' | 'error' | 'game_over' | 'reconnecting';
  message: string;
  player?: string;
}

export interface GameMessage {
  type: string;
  [key: string]: any;
}

export interface ConnectionState {
  connected: boolean;
  reconnecting: boolean;
  reconnectAttempts: number;
}

export interface GameConnectionHookReturn {
  // Connection state
  connectionState: ConnectionState;
  gameLog: GameLogEntry[];
  
  // Functions
  connect: () => void;
  disconnect: () => void;
  sendMessage: (message: any) => void;
  addLogEntry: (entry: GameLogEntry) => void;
  
  // Message handler registration
  onMessage: (handler: (data: GameMessage) => void) => void;
}

interface UseGameConnectionOptions {
  gameId: string;
  playerId: string;
  isPrivate?: boolean;
}

const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

export function useGameConnection({ gameId, playerId, isPrivate = false }: UseGameConnectionOptions): GameConnectionHookReturn {
  // Connection state
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [gameLog, setGameLog] = useState<GameLogEntry[]>([]);
  
  // Refs for WebSocket and timers
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageHandlerRef = useRef<((data: GameMessage) => void) | null>(null);
  
  // Helper function for reconnect delay with exponential backoff
  const getReconnectDelay = useCallback((attempts: number): number => {
    const delay = Math.min(INITIAL_RECONNECT_DELAY * Math.pow(2, attempts), MAX_RECONNECT_DELAY);
    return delay + Math.random() * 1000; // Add jitter
  }, []);

  // Add log entry function
  const addLogEntry = useCallback((entry: GameLogEntry) => {
    setGameLog(prev => [...prev, entry]);
  }, []);

  // Send message function
  const sendMessage = useCallback((message: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Register message handler
  const onMessage = useCallback((handler: (data: GameMessage) => void) => {
    messageHandlerRef.current = handler;
  }, []);

  // Reconnection function
  const attemptReconnect = useCallback(() => {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      addLogEntry({
        type: 'error',
        message: `Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts. Please refresh the page.`
      });
      setReconnecting(false);
      return;
    }

    const delay = getReconnectDelay(reconnectAttempts);
    setReconnectAttempts(prev => prev + 1);
    
    addLogEntry({
      type: 'system',
      message: `Attempting to reconnect... (${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`
    });

    reconnectTimeoutRef.current = setTimeout(() => {
      connect(true); // Pass true to indicate this is a reconnection
    }, delay);
  }, [reconnectAttempts, getReconnectDelay, addLogEntry]);

  // Connect function
  const connect = useCallback((isReconnection = false) => {
    try {
      // Construct WebSocket URL
      const wsUrl = `wss://collaborative-checkmate-server.fly.dev/ws/game/${gameId}/player/${playerId}${isPrivate ? '?is_private=true' : ''}`;
      
      socketRef.current = new WebSocket(wsUrl);

      socketRef.current.onopen = () => {
        setConnected(true);
        setReconnecting(false);
        setReconnectAttempts(0);
        
        if (isReconnection) {
          addLogEntry({ 
            type: 'system', 
            message: 'Successfully reconnected to game server' 
          });
        } else {
          addLogEntry({ 
            type: 'system', 
            message: 'Connected to game server' 
          });
        }
      };

      socketRef.current.onmessage = (event) => {
        try {
          const data: GameMessage = JSON.parse(event.data);
          console.log(`Received message: ${JSON.stringify(data)}`);
          
          // Call the registered message handler
          if (messageHandlerRef.current) {
            messageHandlerRef.current(data);
          }
        } catch (e) {
          console.log(`Error parsing message: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      };

      socketRef.current.onclose = (event) => {
        setConnected(false);
        
        // Only attempt reconnection if this wasn't an intentional close
        if (event.code !== 1000 && !reconnecting) {
          setReconnecting(true);
          addLogEntry({
            type: 'system',
            message: 'Connection lost. Attempting to reconnect...'
          });
          attemptReconnect();
        } else if (!reconnecting) {
          addLogEntry({
            type: 'system',
            message: 'Disconnected from game server'
          });
        }
      };

      socketRef.current.onerror = (error) => {
        console.log(`WebSocket error: ${error instanceof ErrorEvent ? error.message : 'Unknown error'}`);
        
        if (!reconnecting) {
          addLogEntry({
            type: 'error',
            message: 'Connection error occurred'
          });
        }
      };
    } catch (e) {
      console.log(`Error connecting to WebSocket: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }, [gameId, playerId, isPrivate, reconnecting, addLogEntry, attemptReconnect]);

  // Disconnect function
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (socketRef.current) {
      socketRef.current.close(1000); // Normal closure
    }
  }, []);

  // Auto-connect on mount and cleanup on unmount
  useEffect(() => {
    const timer = setTimeout(() => {
      connect();
    }, 1000);

    return () => {
      clearTimeout(timer);
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connectionState: {
      connected,
      reconnecting,
      reconnectAttempts
    },
    gameLog,
    connect,
    disconnect,
    sendMessage,
    addLogEntry,
    onMessage
  };
} 