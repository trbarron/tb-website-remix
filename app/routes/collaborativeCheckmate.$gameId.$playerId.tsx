import React, { useEffect, useRef, useCallback } from "react";
import { Chess } from 'chess.js';
import Chessboard from '~/components/Chessboard';
import { Navbar } from "~/components/Navbar";
import Footer from "~/components/Footer";
import Article from "~/components/Article";
import Timer from "~/components/Timer";
import chessgroundBase from '../styles/chessground.base.css';
import chessgroundBrown from '../styles/chessground.brown.css';
import chessgroundCburnett from '../styles/chessground.cburnett.css';
import { useLoaderData } from "@remix-run/react";

// Import our custom hooks
import { useGameConnection } from "~/hooks/useGameConnection";
import { useGameState, GamePhase, GamePhaseNames } from "~/hooks/useGameState";
import { useStateRestoration } from "~/hooks/useStateRestoration";
import { useGameMessages } from "~/hooks/useGameMessages";

export const links = () => [
  { rel: 'stylesheet', href: chessgroundBase },
  { rel: 'stylesheet', href: chessgroundBrown },
  { rel: 'stylesheet', href: chessgroundCburnett }
];

export const loader = async ({ params }: { params: { gameId: string; playerId: string } }) => {
  const { gameId, playerId } = params;
  return { gameId, playerId };
};

export default function CollaborativeCheckmate() {
  const { gameId, playerId } = useLoaderData<typeof loader>();
  
  // Initialize all hooks
  const gameState = useGameState({ playerId });
  const stateRestoration = useStateRestoration();
  const gameConnection = useGameConnection({ gameId, playerId });
  
  // Refs for current state access in callbacks
  const playersRef = useRef(gameState.players);
  
  // Update refs when state changes
  useEffect(() => {
    playersRef.current = gameState.players;
  }, [gameState.players]);
  
  // Helper to get current players for message handler
  const getCurrentPlayers = useCallback(() => playersRef.current, []);
  
  // Helper to get player ready state
  const getPlayerReady = useCallback((seat: string) => {
    return playersRef.current[seat as keyof typeof playersRef.current]?.ready || false;
  }, []);
  
  // Initialize message handler
  const messageHandler = useGameMessages({
    playerId,
    setChessPosition: gameState.setChessPosition,
    setGamePhase: gameState.setGamePhase,
    setTimeRemaining: gameState.setTimeRemaining,
    updatePlayers: gameState.updatePlayers,
    setShapes: gameState.setShapes,
    setSelectedMove: gameState.setSelectedMove,
    setLockedIn: gameState.setLockedIn,
    takeSeat: gameState.takeSeat,
    setPlayerReady: gameState.setPlayerReady,
    getCurrentPlayerSeat: gameState.getCurrentPlayerSeat,
    addLogEntry: gameConnection.addLogEntry,
    storePlayerState: stateRestoration.storePlayerState,
    getCurrentPlayers
  });
  
  // Register message handler with connection
  useEffect(() => {
    gameConnection.onMessage(messageHandler.handleMessage);
  }, [gameConnection, messageHandler.handleMessage]);
  
  // Store player state before disconnections
  useEffect(() => {
    const currentSeat = gameState.getCurrentPlayerSeat();
    if (currentSeat) {
      const isReady = gameState.players[currentSeat]?.ready || false;
      stateRestoration.storePlayerState(currentSeat, isReady);
    }
  }, [gameState.players, gameState.getCurrentPlayerSeat, stateRestoration.storePlayerState]);
  
  // Handle reconnection state restoration
  useEffect(() => {
    if (gameConnection.connectionState.connected && !gameConnection.connectionState.reconnecting) {
      // Check if this was a reconnection by seeing if we have stored state
      if (stateRestoration.lastKnownSeat) {
        setTimeout(() => {
          stateRestoration.attemptStateRestoration(
            gameState.getCurrentPlayerSeat,
            getPlayerReady,
            gameConnection.sendMessage,
            gameConnection.addLogEntry,
            playerId
          );
        }, 2000); // Wait a bit for game state to synchronize
      }
    }
  }, [
    gameConnection.connectionState.connected,
    gameConnection.connectionState.reconnecting,
    stateRestoration.lastKnownSeat,
    stateRestoration.attemptStateRestoration,
    gameState.getCurrentPlayerSeat,
    getPlayerReady,
    gameConnection.sendMessage,
    gameConnection.addLogEntry,
    playerId
  ]);
  
  // Game actions
  const handleTakeSeat = useCallback((seat: string) => {
    if (!gameConnection.connectionState.connected) {
      gameConnection.addLogEntry({
        type: 'error',
        message: 'Cannot take seat: Not connected'
      });
      return;
    }

    if (!gameState.canTakeSeat(seat as any)) {
      gameConnection.addLogEntry({
        type: 'error',
        message: 'Cannot take this seat'
      });
      return;
    }

    gameConnection.sendMessage({
      type: "take_seat",
      seat: seat
    });
  }, [gameConnection, gameState]);

  const handleReadyUp = useCallback(() => {
    gameConnection.sendMessage({
      type: "ready",
      player_id: playerId
    });
  }, [gameConnection, playerId]);

  const handleLockInMove = useCallback(() => {
    gameConnection.sendMessage({
      type: "lock_in_move",
      player_id: playerId
    });
    
    gameState.setLockedIn(true);
  }, [gameConnection, playerId, gameState]);

  const handleChessboardMove = useCallback((orig: string, dest: string) => {
    if (!gameConnection.connectionState.connected) return;
    
    let chessCopy = new Chess(gameState.fen);
    chessCopy.move({ from: orig, to: dest, promotion: 'q' });
    
    gameConnection.sendMessage({
      type: "submit_move",
      player_id: playerId,
      move: chessCopy.fen()
    });

    // Reset position to original FEN (the move is just a suggestion to the server)
    gameState.setChessPosition(gameState.fen);
    gameState.setSelectedMove(true);
    gameState.setShapes([{
      orig: orig,
      dest: dest,
      brush: 'blue'
    }]);
  }, [gameConnection, gameState, playerId]);

  // Check if current player can make moves
  const canMakeMove = (gameState.gamePhase === GamePhase.TEAM1_SELECTION && gameState.playerTeam === 1) ||
                     (gameState.gamePhase === GamePhase.TEAM2_SELECTION && gameState.playerTeam === 2);
  
  const isViewOnly = !canMakeMove || gameState.lockedIn;

  return (
    <div className="bg-background bg-fixed min-h-screen">
      <Navbar />
      <main className="flex-grow">
        <Article title="Collaborative Checkmate" subtitle="">
          <div className="pb-6 mx-auto grid gap-6 grid-cols-1 md:grid-cols-3">
            {/* Chessboard */}
            <div className="md:col-span-2">
              <div className="mb-4">
                <div className={`mb-4 p-2 rounded transition-all duration-300 ${canMakeMove ? 'bg-white' : 'bg-transparent'}`}>
                  <div className="relative">
                    <Chessboard
                      initialFen={gameState.fen}
                      orientation={gameState.orientation}
                      viewOnly={isViewOnly}
                      movable={{
                        free: false,
                        color: gameState.playerTeam === 1 ? 'white' : 'black'
                      } as any}
                      events={{
                        move: handleChessboardMove
                      }}
                      drawable={{
                        enabled: true,
                        visible: true,
                        defaultSnapToValidMove: true,
                        eraseOnClick: true,
                        autoShapes: gameState.shapes
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Game Phase Indicator */}
              <div className="bg-white shadow rounded p-4 mb-2">
                <Timer
                  timeRemaining={gameState.timeRemaining}
                  key={gameState.timeRemainingKey}
                />
                <div className="relative h-12 flex items-center">
                  <div className="absolute w-full h-2 bg-gray-200 rounded-full"></div>

                  {/* Phase Markers */}
                  <div className={`relative z-10 h-6 w-6 rounded-full border-2 border-white ${gameState.gamePhase === GamePhase.TEAM1_SELECTION ? 'bg-gray-500' : 'bg-gray-300'} flex items-center justify-center text-xs text-white font-bold ml-0`}>•</div>
                  <div className="flex-grow h-2"></div>

                  <div className={`relative z-10 h-6 w-6 rounded-full border-2 border-white ${gameState.gamePhase === GamePhase.TEAM1_COMPUTING ? 'bg-gray-500' : 'bg-gray-300'} flex items-center justify-center text-xs text-white font-bold`}>•</div>
                  <div className="flex-grow h-2"></div>

                  <div className={`relative z-10 h-6 w-6 rounded-full border-2 border-white ${gameState.gamePhase === GamePhase.TEAM2_COMPUTING ? 'bg-gray-500' : 'bg-gray-300'} flex items-center justify-center text-xs text-white font-bold mr-0`}>•</div>
                  <div className="flex-grow h-2"></div>

                  <div className={`relative z-10 h-6 w-6 rounded-full border-2 border-white ${gameState.gamePhase === GamePhase.TEAM2_SELECTION ? 'bg-gray-500' : 'bg-gray-300'} flex items-center justify-center text-xs text-white font-bold`}>•</div>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="bg-white text-black px-2 py-1">Select</span>
                  <span className="bg-white text-black px-2 py-1">Compute</span>
                  <span className="bg-gray-700 text-white px-2 py-1">Compute</span>
                  <span className="bg-gray-700 text-white px-2 py-1">Select</span>
                </div>
              </div>

              {/* Lock In Move Button */}
              <div className="grid grid-cols-1 gap-2 mb-12">
                <button
                  onClick={handleLockInMove}
                  className={`p-2 rounded font-bold transition-colors duration-200
                    ${!gameConnection.connectionState.connected || !gameState.selectedMove || gameState.lockedIn
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-500 hover:bg-gray-600 text-white'
                    }`}
                  disabled={!gameConnection.connectionState.connected || !gameState.selectedMove || gameState.lockedIn}
                >
                  Lock In Move
                </button>
              </div>

              {/* Player Seats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white shadow rounded p-3 pt-0 mb-2">
                  <h3 className="font-bold text-gray-500 text-lg my-1">White</h3>
                  <div className="space-y-2">
                    {/* White Player 1 */}
                    <div
                      className={`flex items-center p-2 rounded ${gameState.players.t1p1.id === playerId ? 'bg-blue-100' : ''
                        } ${gameState.canTakeSeat('t1p1') ?
                          'border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-100' :
                          'border border-gray-200'
                        }`}
                      onClick={() => gameState.canTakeSeat('t1p1') && handleTakeSeat('t1p1')}
                    >
                      <div className={`w-6 h-6 rounded-full mr-2 ${gameState.players.t1p1.ready ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                      <span>{gameState.players.t1p1.id || '< Click to Join >'}</span>
                      {gameState.players.t1p1.id === playerId && <span className="ml-2 text-xs text-blue-600">(You)</span>}
                    </div>

                    {/* White Player 2 */}
                    <div
                      className={`flex items-center p-2 rounded ${gameState.players.t1p2.id === playerId ? 'bg-blue-100' : ''
                        } ${gameState.canTakeSeat('t1p2') ?
                          'border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-100' :
                          'border border-gray-200'
                        }`}
                      onClick={() => gameState.canTakeSeat('t1p2') && handleTakeSeat('t1p2')}
                    >
                      <div className={`w-6 h-6 rounded-full mr-2 ${gameState.players.t1p2.ready ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                      <span>{gameState.players.t1p2.id || '<Click to Join>'}</span>
                      {gameState.players.t1p2.id === playerId && <span className="ml-2 text-xs text-blue-600">(You)</span>}
                    </div>
                  </div>
                </div>

                <div className="bg-white shadow rounded p-3 pt-0 mb-2">
                  <h3 className="font-bold text-gray-500 text-lg my-1">Black</h3>
                  <div className="space-y-2">
                    {/* Black Player 1 */}
                    <div
                      className={`flex items-center p-2 rounded ${gameState.players.t2p1.id === playerId ? 'bg-blue-100' : ''
                        } ${gameState.canTakeSeat('t2p1') ?
                          'border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-100' :
                          'border border-gray-200'
                        }`}
                      onClick={() => gameState.canTakeSeat('t2p1') && handleTakeSeat('t2p1')}
                    >
                      <div className={`w-6 h-6 rounded-full mr-2 ${gameState.players.t2p1.ready ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                      <span>{gameState.players.t2p1.id || '< Click to Join >'}</span>
                      {gameState.players.t2p1.id === playerId && <span className="ml-2 text-xs text-blue-600">(You)</span>}
                    </div>

                    {/* Black Player 2 */}
                    <div
                      className={`flex items-center p-2 rounded ${gameState.players.t2p2.id === playerId ? 'bg-blue-100' : ''
                        } ${gameState.canTakeSeat('t2p2') ?
                          'border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-100' :
                          'border border-gray-200'
                        }`}
                      onClick={() => gameState.canTakeSeat('t2p2') && handleTakeSeat('t2p2')}
                    >
                      <div className={`w-6 h-6 rounded-full mr-2 ${gameState.players.t2p2.ready ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                      <span>{gameState.players.t2p2.id || '< Click to Join >'}</span>
                      {gameState.players.t2p2.id === playerId && <span className="ml-2 text-xs text-blue-600">(You)</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ready Up Button */}
              <div className="grid grid-cols-1 gap-2 mb-4">
                <button
                  onClick={handleReadyUp}
                  className={`p-2 rounded font-bold transition-colors duration-200
                    ${!gameConnection.connectionState.connected || !gameState.getCurrentPlayerSeat() || gameState.isPlayerReady()
                      ? 'bg-purple-300 text-purple-100 cursor-not-allowed'
                      : 'bg-purple-500 hover:bg-purple-600 text-white'
                    }`}
                  disabled={!gameConnection.connectionState.connected || !gameState.getCurrentPlayerSeat() || gameState.isPlayerReady()}
                >
                  Ready Up
                </button>
              </div>
            </div>

            {/* Game log panel */}
            <div className="md:col-span-1">
              {/* Game log */}
              <div className="bg-white shadow rounded overflow-hidden mb-4">
                <div className="border-b-2 border-green-500 p-2 font-bold bg-white flex justify-between items-center">
                  <span>Game Log</span>
                  {gameConnection.connectionState.reconnecting && (
                    <span className="text-xs text-orange-600 font-normal flex items-center">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-500 mr-1"></div>
                      Reconnecting...
                    </span>
                  )}
                  {!gameConnection.connectionState.connected && !gameConnection.connectionState.reconnecting && (
                    <span className="text-xs text-red-600 font-normal">
                      Disconnected
                    </span>
                  )}
                </div>
                <div
                  className="h-96 overflow-y-auto p-2 bg-gray-50"
                  ref={(el) => {
                    if (el) {
                      el.scrollTop = el.scrollHeight;
                    }
                  }}
                >
                  {gameConnection.gameLog.map((entry, index) => (
                    <div key={index} className={`mb-1 p-1 rounded text-xs ${entry.type === 'system' ? 'bg-gray-100' :
                      entry.type === 'move' ? 'bg-blue-50' :
                        entry.type === 'engine' ? 'bg-yellow-50' :
                          entry.type === 'phase' ? 'bg-white' :
                            entry.type === 'error' ? 'bg-red-50' :
                              entry.type === 'game_over' ? 'bg-purple-50' :
                                entry.type === 'reconnecting' ? 'bg-orange-50' : ''
                      }`}>
                      {entry.player && <span className="font-bold">{entry.player}: </span>}
                      {entry.message}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Article>
      </main>
      <Footer />
    </div>
  );
}