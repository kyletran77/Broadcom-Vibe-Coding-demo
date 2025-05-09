import os
import random
from flask import Flask, render_template, request, session
from flask_socketio import SocketIO, emit, join_room, leave_room
import threading
import time

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'pictionary-secret'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Game state
games = {}  # Dictionary to store all active games
# Format: {
#   'game_id': {
#       'players': [{'name': 'player1', 'score': 0}, ...],
#       'current_drawer': 0,  # Index in players list
#       'current_word': 'apple',
#       'round_timer': 60,
#       'round_in_progress': False,
#       'guessed_players': []  # List of players who guessed correctly
#   }
# }

# Load words from file
def load_words():
    words = []
    with open('words.txt', 'r') as file:
        for line in file:
            word = line.strip()
            if word:
                words.append(word)
    return words

words_list = load_words()

# Routes
@app.route('/')
def index():
    return render_template('index.html')

# Socket.IO event handlers
@socketio.on('connect')
def handle_connect():
    print(f"Client connected: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    print(f"Client disconnected: {request.sid}")
    # Handle player disconnect logic here

@socketio.on('create_game')
def handle_create_game(data):
    """Create a new game and return game ID"""
    game_id = generate_game_id()
    host_name = data.get('host_name')
    
    games[game_id] = {
        'players': [{'name': host_name, 'id': request.sid, 'score': 0}],
        'current_drawer': 0,
        'current_word': '',
        'round_timer': 60,
        'round_in_progress': False,
        'guessed_players': []
    }
    
    join_room(game_id)
    emit('game_created', {'game_id': game_id, 'player_name': host_name})
    return {'game_id': game_id}

@socketio.on('join_game')
def handle_join_game(data):
    """Allow a player to join an existing game"""
    game_id = data.get('game_id')
    player_name = data.get('player_name')
    
    if game_id not in games:
        emit('error', {'message': 'Game not found'})
        return
    
    # Check if the game has already started
    if games[game_id]['round_in_progress']:
        emit('error', {'message': 'Game already in progress'})
        return
    
    # Add player to the game
    games[game_id]['players'].append({'name': player_name, 'id': request.sid, 'score': 0})
    
    join_room(game_id)
    
    # Notify all players in the room about the new player
    emit('player_joined', {
        'player_name': player_name, 
        'players': [p['name'] for p in games[game_id]['players']]
    }, room=game_id)

@socketio.on('start_game')
def handle_start_game(data):
    """Start the game with the current players"""
    game_id = data.get('game_id')
    
    if game_id not in games:
        emit('error', {'message': 'Game not found'})
        return
    
    if len(games[game_id]['players']) < 2:
        emit('error', {'message': 'Need at least 2 players to start'})
        return
    
    # Start the first round
    start_new_round(game_id)
    
    emit('game_started', room=game_id)

@socketio.on('draw_action')
def handle_draw_action(data):
    """Broadcast drawing actions to all players in the room"""
    game_id = data.get('game_id')
    draw_data = data.get('draw_data')
    
    if game_id not in games:
        return
    
    # Forward drawing data to all clients except the sender
    emit('draw_update', draw_data, room=game_id, include_self=False)

@socketio.on('guess')
def handle_guess(data):
    """Process a guess from a player"""
    game_id = data.get('game_id')
    player_id = request.sid
    guess = data.get('guess').lower().strip()
    
    if game_id not in games or not games[game_id]['round_in_progress']:
        return
    
    game = games[game_id]
    
    # Find player name
    player_name = None
    player_index = -1
    for i, player in enumerate(game['players']):
        if player['id'] == player_id:
            player_name = player['name']
            player_index = i
            break
    
    if player_name is None or player_index == game['current_drawer']:
        return  # Player not found or is the drawer
    
    current_word = game['current_word'].lower()
    
    # Check if the guess is correct
    if guess == current_word and player_id not in game['guessed_players']:
        # Player guessed correctly
        game['guessed_players'].append(player_id)
        
        # Award points
        game['players'][player_index]['score'] += 10  # Points for correct guess
        drawer_index = game['current_drawer']
        game['players'][drawer_index]['score'] += 5   # Points for drawer
        
        # Notify all players about the correct guess
        emit('correct_guess', {
            'player_name': player_name,
            'scores': [{'name': p['name'], 'score': p['score']} for p in game['players']]
        }, room=game_id)
        
        # Check if all players have guessed
        if len(game['guessed_players']) >= len(game['players']) - 1:
            # All guessers have guessed correctly, end the round
            end_round(game_id)
        
    else:
        # Broadcast the incorrect guess to all players
        emit('new_guess', {'player_name': player_name, 'guess': guess}, room=game_id)

@socketio.on('skip_word')
def handle_skip_word(data):
    """Allow the drawer to skip the current word"""
    game_id = data.get('game_id')
    player_id = request.sid
    
    if game_id not in games:
        return
    
    game = games[game_id]
    
    # Check if the requester is the current drawer
    drawer_id = game['players'][game['current_drawer']]['id']
    if player_id != drawer_id:
        emit('error', {'message': 'Only the drawer can skip the word'}, room=player_id)
        return
    
    # End the round and start a new one
    end_round(game_id, skipped=True)

def timer_callback(game_id):
    """Function to be called when the timer expires"""
    time.sleep(60)  # Wait for 60 seconds
    if game_id in games and games[game_id]['round_in_progress']:
        end_round(game_id, timeout=True)

def start_new_round(game_id):
    """Start a new round for the given game"""
    if game_id not in games:
        return
    
    game = games[game_id]
    
    # Move to the next drawer
    game['current_drawer'] = (game['current_drawer'] + 1) % len(game['players'])
    
    # Choose a random word
    game['current_word'] = random.choice(words_list)
    
    # Reset round state
    game['round_in_progress'] = True
    game['guessed_players'] = []
    
    # Get the drawer's socket ID
    drawer_id = game['players'][game['current_drawer']]['id']
    drawer_name = game['players'][game['current_drawer']]['name']
    
    # Inform all players about the new round
    for player in game['players']:
        if player['id'] == drawer_id:
            # Send the word to the drawer
            socketio.emit('new_round', {
                'is_drawer': True,
                'word': game['current_word'],
                'drawer_name': drawer_name
            }, room=player['id'])
        else:
            # Don't send the word to guessers
            socketio.emit('new_round', {
                'is_drawer': False,
                'word_length': len(game['current_word']),
                'drawer_name': drawer_name
            }, room=player['id'])
    
    # Start the timer (60 seconds per round)
    timer_thread = threading.Thread(target=timer_callback, args=(game_id,))
    timer_thread.daemon = True
    timer_thread.start()

def delayed_start_next_round(game_id):
    """Wait 5 seconds and then start a new round"""
    time.sleep(5)
    if game_id in games:
        start_new_round(game_id)

def end_round(game_id, timeout=False, skipped=False):
    """End the current round and prepare for the next one"""
    if game_id not in games:
        return
    
    game = games[game_id]
    game['round_in_progress'] = False
    
    result = {
        'word': game['current_word'],
        'scores': [{'name': p['name'], 'score': p['score']} for p in game['players']],
        'timeout': timeout,
        'skipped': skipped,
        'correct_guessers': [p['name'] for p in game['players'] if p['id'] in game['guessed_players']]
    }
    
    # Send round summary to all players
    socketio.emit('round_ended', result, room=game_id)
    
    # Wait 5 seconds before starting the next round
    next_round_thread = threading.Thread(target=delayed_start_next_round, args=(game_id,))
    next_round_thread.daemon = True
    next_round_thread.start()

def generate_game_id():
    """Generate a random 6-character game ID"""
    letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    return ''.join(random.choice(letters) for _ in range(6))

if __name__ == '__main__':
    # Create template directory if it doesn't exist
    os.makedirs('templates', exist_ok=True)
    os.makedirs('static', exist_ok=True)
    
    # Use PORT env variable for compatibility with Render and other PaaS
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=True) 