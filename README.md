# Pictionary Game for Friends

A simple, locally-hosted Pictionary game to play with friends on the same network.

## Features

- Create or join a game room
- Take turns drawing and guessing
- Real-time drawing canvas
- Timer for each round
- Score tracking
- Mobile-friendly design

## Requirements

- Python 3.7 or higher
- Flask and Flask-SocketIO (for the server)
- A modern web browser

## Setup & Installation

1. Clone this repository or download the files
2. Install the required packages:

```bash
pip install -r requirements.txt
```

## How to Run

1. Start the server:

```bash
python app.py
```

2. The game will be available at `http://localhost:5000`

3. To allow friends to connect:
   - Make sure you're all on the same WiFi/network
   - Find your local IP address (e.g., by running `ipconfig` on Windows or `ifconfig` on Mac/Linux)
   - Have your friends visit `http://YOUR_IP_ADDRESS:5000` in their browsers

## How to Play

1. **Create a Game:**
   - Enter your name and click "Create Game"
   - Share the generated game code with your friends

2. **Join a Game:**
   - Enter your name and the game code
   - Click "Join Game"

3. **Start Playing:**
   - The host clicks "Start Game" when everyone has joined
   - Players take turns drawing and guessing
   - The drawer can see the word to draw, others try to guess
   - Guessers type guesses in the input field
   - Points are awarded for correct guesses
   - The drawer can skip difficult words if needed

## Development

Feel free to customize this game! You can add more words to `words.txt` or modify the game mechanics in `app.py`.

## License

This project is open source and available for personal use. 