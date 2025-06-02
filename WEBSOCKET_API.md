# WebSocket API Documentation - Collaborative Checkmate

This document defines the WebSocket API contract between the client and server for the Collaborative Checkmate game.

## Connection

### WebSocket URL
```
wss://collaborative-checkmate-server.fly.dev/ws/game/{gameId}/player/{playerId}[?is_private=true]
```

**Parameters:**
- `gameId`: Unique identifier for the game session
- `playerId`: Unique identifier for the player
- `is_private` (optional): Boolean query parameter to create/join private games

## Message Format

All messages are JSON objects with a `type` field indicating the message type.

---

## Client → Server Messages

### 1. Take Seat
**Purpose:** Request to occupy a specific seat in the game

```json
{
  "type": "take_seat",
  "seat": "t1p1" | "t1p2" | "t2p1" | "t2p2"
}
```

**Fields:**
- `seat`: The seat identifier
  - `t1p1`: Team 1, Player 1 (White team)
  - `t1p2`: Team 1, Player 2 (White team)
  - `t2p1`: Team 2, Player 1 (Black team)
  - `t2p2`: Team 2, Player 2 (Black team)

**Expected Response:** `game_state_update` with updated seat assignments

---

### 2. Ready Up
**Purpose:** Indicate that the player is ready to start the game

```json
{
  "type": "ready",
  "player_id": "string"
}
```

**Fields:**
- `player_id`: The player's unique identifier

**Expected Response:** `player_ready` message followed by potential `game_state_update`

---

### 3. Submit Move
**Purpose:** Submit a chess move during selection phase

```json
{
  "type": "submit_move",
  "player_id": "string",
  "move": "string"
}
```

**Fields:**
- `player_id`: The player's unique identifier
- `move`: FEN string representing the board state after the move

**Expected Response:** `move_submitted` confirmation

---

### 4. Lock In Move
**Purpose:** Confirm the submitted move (prevents further changes)

```json
{
  "type": "lock_in_move",
  "player_id": "string"
}
```

**Fields:**
- `player_id`: The player's unique identifier

**Expected Response:** Move is locked and cannot be changed

---

### 5. Heartbeat
**Purpose:** Keep connection alive and detect connection issues

```json
{
  "type": "heartbeat",
  "timestamp": number,
  "connectionId": "string"
}
```

**Fields:**
- `timestamp`: Client timestamp when heartbeat was sent (milliseconds since epoch)
- `connectionId`: Unique identifier for this connection session

**Expected Response:** `heartbeat_response` with server timestamp

---

## Server → Client Messages

### 1. Connection Established
**Purpose:** Confirm successful WebSocket connection

```json
{
  "type": "connection_established"
}
```

---

### 2. Game State Update
**Purpose:** Comprehensive game state synchronization

```json
{
  "type": "game_state_update",
  "game_phase": "setup" | "team1_selection" | "team1_computing" | "team2_selection" | "team2_computing" | "cooldown",
  "duration": number,
  "fen": "string",
  "last_move": "string",
  "t1p1_seat": "string",
  "t1p1_ready": "true" | "false",
  "t1p2_seat": "string", 
  "t1p2_ready": "true" | "false",
  "t2p1_seat": "string",
  "t2p1_ready": "true" | "false",
  "t2p2_seat": "string",
  "t2p2_ready": "true" | "false"
}
```

**Fields:**
- `game_phase`: Current phase of the game
- `duration`: Time remaining in current phase (seconds)
- `fen`: Current chess position in FEN notation
- `last_move`: Last move played in algebraic notation (e.g., "e2e4")
- `{seat}_seat`: Player ID occupying the seat (empty string if vacant)
- `{seat}_ready`: Ready status of the seat ("true"/"false")

**Game Phases:**
- `setup`: Initial game setup, players joining seats
- `team1_selection`: White team selecting their move
- `team1_computing`: Server computing white team's move
- `team2_selection`: Black team selecting their move  
- `team2_computing`: Server computing black team's move
- `cooldown`: Brief pause between moves

---

### 3. Timer Update
**Purpose:** Real-time timer synchronization

```json
{
  "type": "timer_update",
  "seconds_remaining": number,
  "key": "string"
}
```

**Fields:**
- `seconds_remaining`: Exact time remaining in current phase
- `key`: Unique identifier for this timer instance

---

### 4. Player Ready
**Purpose:** Notification when a player becomes ready

```json
{
  "type": "player_ready",
  "player_id": "string"
}
```

**Fields:**
- `player_id`: ID of the player who became ready

---

### 5. Move Submitted
**Purpose:** Confirmation that a move was submitted

```json
{
  "type": "move_submitted",
  "player_id": "string"
}
```

**Fields:**
- `player_id`: ID of the player who submitted the move

---

### 6. Move Selected
**Purpose:** Notification of the final move chosen by the engine

```json
{
  "type": "move_selected",
  "move": {
    "from": "string",
    "to": "string", 
    "submitted_by": "string"
  }
}
```

**Fields:**
- `move.from`: Starting square (e.g., "e2")
- `move.to`: Destination square (e.g., "e4")
- `move.submitted_by`: Player ID who submitted the selected move

---

### 7. Player Disconnected
**Purpose:** Notification when a player disconnects

```json
{
  "type": "player_disconnected",
  "player_id": "string"
}
```

**Fields:**
- `player_id`: ID of the disconnected player

---

### 8. Game Over
**Purpose:** Notification when the game ends

```json
{
  "type": "game_over",
  "result": "string",
  "message": "string",
  "total_moves": number,
  "team_coordination": {
    "team1_same_moves": number,
    "team2_same_moves": number
  },
  "final_position": "string"
}
```

**Fields:**
- `result`: Game result (e.g., "checkmate", "stalemate", "draw")
- `message`: Human-readable game over message
- `total_moves`: Total number of moves played
- `team_coordination`: Statistics on team coordination
- `final_position`: Final board position in FEN notation

---

### 9. Heartbeat Response
**Purpose:** Acknowledge heartbeat and provide server timestamp

```json
{
  "type": "heartbeat_response",
  "timestamp": number
}
```

**Fields:**
- `timestamp`: Server timestamp when response was sent (milliseconds since epoch)

---

## Connection Handling

### Heartbeat Mechanism
The client implements a heartbeat system to maintain connection health:
- Heartbeat interval: 30 seconds
- Timeout threshold: 60 seconds (2 missed heartbeats)
- Automatic reconnection triggered on heartbeat timeout
- Connection ID used to track connection sessions

### Reconnection Strategy
The client implements automatic reconnection with exponential backoff:
- Initial delay: 1 second
- Maximum delay: 30 seconds  
- Maximum attempts: 10
- Jitter added to prevent thundering herd

### State Restoration
On reconnection, the client:
1. Waits for `game_state_update` message
2. Attempts to restore previous seat assignment
3. Restores ready status if previously ready
4. Updates local game state to match server

### Error Handling
- Invalid seat assignments are rejected
- Move submissions outside selection phase are ignored
- Ready requests from unseated players are rejected
- Malformed messages are logged and ignored
- Heartbeat timeouts trigger reconnection

---

## Game Flow

1. **Setup Phase**
   - Players connect and take seats
   - Players ready up when satisfied with team composition
   - Game starts when all 4 seats are filled and ready

2. **Selection Phases**
   - Active team has limited time to submit moves
   - Players can submit multiple moves, latest overwrites previous
   - Players can lock in moves to prevent further changes

3. **Computing Phases**
   - Server selects final move (implementation-specific algorithm)
   - Move is executed and board state updated
   - Game transitions to next team's selection phase

4. **Game End**
   - Standard chess end conditions (checkmate, stalemate, etc.)
   - Statistics and final position provided
   - Players can start new game or disconnect

---

## Error Conditions

### Client Errors
- Attempting to take occupied seat
- Submitting moves when not in selection phase
- Ready up without being seated
- Invalid move format
- Heartbeat timeout

### Server Errors  
- Connection timeout
- Invalid game/player ID
- Server overload
- Network issues
- Missed heartbeat responses

### Recovery
- Client automatically reconnects on connection loss
- Server maintains game state during brief disconnections
- Long disconnections may result in player removal from seat
- Heartbeat failures trigger immediate reconnection attempt 