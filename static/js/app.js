// Connect to the Socket.IO server
const socket = io();

// Game state variables
let gameId = null;
let playerName = null;
let isDrawer = false;
let currentWord = null;
let roundNumber = 1;
let countdownInterval = null;
let drawingCanvas = null;
let ctx = null;
let currentColor = 'black';
let currentSize = 5;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

// DOM Elements
const lobbyScreen = document.getElementById('lobby-screen');
const waitingRoom = document.getElementById('waiting-room');
const gameScreen = document.getElementById('game-screen');
const roundSummary = document.getElementById('round-summary');
const gameOver = document.getElementById('game-over');

const hostNameInput = document.getElementById('host-name');
const playerNameInput = document.getElementById('player-name');
const gameIdInput = document.getElementById('game-id-input');
const createGameBtn = document.getElementById('create-game-btn');
const joinGameBtn = document.getElementById('join-game-btn');
const startGameBtn = document.getElementById('start-game-btn');
const gameCodeSpan = document.getElementById('game-code');
const playersList = document.getElementById('players');

const roundNumberSpan = document.getElementById('round-number');
const timerDiv = document.getElementById('timer');
const wordDisplay = document.getElementById('word-display');
const drawerNameDiv = document.getElementById('drawer-name');
const canvas = document.getElementById('drawing-canvas');
const drawingControls = document.getElementById('drawing-controls');
const guessingArea = document.getElementById('guessing-area');
const guessesList = document.getElementById('guesses-list');
const clearCanvasBtn = document.getElementById('clear-canvas');
const skipWordBtn = document.getElementById('skip-word');
const guessInput = document.getElementById('guess-input');
const submitGuessBtn = document.getElementById('submit-guess');
const colorBtns = document.querySelectorAll('.color-btn');
const brushSize = document.getElementById('brush-size');

const revealWordSpan = document.getElementById('reveal-word');
const correctGuessersDiv = document.getElementById('correct-guessers');
const scoresList = document.getElementById('scores-list');
const countdownSpan = document.getElementById('countdown');
const finalScoresList = document.getElementById('final-scores-list');
const playAgainBtn = document.getElementById('play-again');

// Initialize the drawing canvas
function initCanvas() {
    drawingCanvas = document.getElementById('drawing-canvas');
    ctx = drawingCanvas.getContext('2d');
    
    // Set canvas size proportionally
    const containerWidth = drawingCanvas.parentElement.clientWidth;
    if (containerWidth < 800) {
        drawingCanvas.width = containerWidth - 40;
        drawingCanvas.height = (containerWidth - 40) * 0.75;
    }
    
    // Canvas event listeners
    drawingCanvas.addEventListener('mousedown', startDrawing);
    drawingCanvas.addEventListener('mousemove', draw);
    drawingCanvas.addEventListener('mouseup', stopDrawing);
    drawingCanvas.addEventListener('mouseout', stopDrawing);
    
    // Touch support
    drawingCanvas.addEventListener('touchstart', handleTouch);
    drawingCanvas.addEventListener('touchmove', handleTouch);
    drawingCanvas.addEventListener('touchend', stopDrawing);
}

// Drawing functions
function startDrawing(e) {
    if (!isDrawer) return;
    isDrawing = true;
    
    const rect = drawingCanvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
}

function draw(e) {
    if (!isDrawer || !isDrawing) return;
    
    const rect = drawingCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Draw on local canvas
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    
    // Send drawing data to server
    const drawData = {
        x0: lastX / drawingCanvas.width,  // Normalize coordinates between 0 and 1
        y0: lastY / drawingCanvas.height,
        x1: x / drawingCanvas.width,
        y1: y / drawingCanvas.height,
        color: currentColor,
        size: currentSize
    };
    
    socket.emit('draw_action', {
        game_id: gameId,
        draw_data: drawData
    });
    
    lastX = x;
    lastY = y;
}

function stopDrawing() {
    isDrawing = false;
}

function handleTouch(e) {
    e.preventDefault();
    
    if (e.type === 'touchstart') {
        if (!isDrawer) return;
        isDrawing = true;
        
        const rect = drawingCanvas.getBoundingClientRect();
        const touch = e.touches[0];
        lastX = touch.clientX - rect.left;
        lastY = touch.clientY - rect.top;
    } else if (e.type === 'touchmove' && isDrawing) {
        const rect = drawingCanvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        // Draw on local canvas
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
        
        // Send drawing data to server
        const drawData = {
            x0: lastX / drawingCanvas.width,
            y0: lastY / drawingCanvas.height,
            x1: x / drawingCanvas.width,
            y1: y / drawingCanvas.height,
            color: currentColor,
            size: currentSize
        };
        
        socket.emit('draw_action', {
            game_id: gameId,
            draw_data: drawData
        });
        
        lastX = x;
        lastY = y;
    }
}

function clearCanvas() {
    ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    
    // Let others know the canvas was cleared
    socket.emit('draw_action', {
        game_id: gameId,
        draw_data: { clear: true }
    });
}

// Event Listeners
createGameBtn.addEventListener('click', () => {
    const name = hostNameInput.value.trim();
    if (name) {
        playerName = name;
        socket.emit('create_game', { host_name: name });
    }
});

joinGameBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    const id = gameIdInput.value.trim().toUpperCase();
    if (name && id) {
        playerName = name;
        gameId = id;
        socket.emit('join_game', { game_id: id, player_name: name });
    }
});

startGameBtn.addEventListener('click', () => {
    socket.emit('start_game', { game_id: gameId });
});

colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all buttons
        colorBtns.forEach(b => b.classList.remove('active'));
        
        // Add active class to clicked button
        btn.classList.add('active');
        
        // Set current color
        currentColor = btn.dataset.color;
    });
});

brushSize.addEventListener('input', () => {
    currentSize = brushSize.value;
});

clearCanvasBtn.addEventListener('click', clearCanvas);

skipWordBtn.addEventListener('click', () => {
    socket.emit('skip_word', { game_id: gameId });
});

submitGuessBtn.addEventListener('click', () => {
    submitGuess();
});

guessInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        submitGuess();
    }
});

playAgainBtn.addEventListener('click', () => {
    // Reset the game state
    window.location.reload();
});

function submitGuess() {
    const guess = guessInput.value.trim();
    if (guess) {
        socket.emit('guess', {
            game_id: gameId,
            guess: guess
        });
        guessInput.value = '';
    }
}

// Socket.IO event handlers
socket.on('game_created', (data) => {
    lobbyScreen.querySelector('.join-create').classList.add('hidden');
    waitingRoom.classList.remove('hidden');
    
    gameId = data.game_id;
    gameCodeSpan.textContent = gameId;
    
    // Add host to player list
    updatePlayersList([data.player_name]);
});

socket.on('player_joined', (data) => {
    updatePlayersList(data.players);
});

socket.on('game_started', () => {
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    initCanvas();
});

socket.on('new_round', (data) => {
    isDrawer = data.is_drawer;
    
    // Update round number
    roundNumberSpan.textContent = roundNumber++;
    
    // Clear canvas
    if (ctx) {
        ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    }
    
    // Clear guesses
    guessesList.innerHTML = '';
    
    // Update word display
    if (isDrawer) {
        currentWord = data.word;
        wordDisplay.textContent = `Your word: ${data.word}`;
        drawingControls.classList.remove('hidden');
        guessingArea.classList.add('hidden');
    } else {
        wordDisplay.textContent = `Word: ${'_'.repeat(data.word_length)}`;
        drawingControls.classList.add('hidden');
        guessingArea.classList.remove('hidden');
    }
    
    // Update drawer name
    drawerNameDiv.textContent = `${data.drawer_name} is drawing`;
    
    // Show game screen
    roundSummary.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    
    // Start the timer
    startTimer(60);
});

socket.on('draw_update', (data) => {
    if (data.clear) {
        ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        return;
    }
    
    // Convert normalized coordinates back to canvas size
    const x0 = data.x0 * drawingCanvas.width;
    const y0 = data.y0 * drawingCanvas.height;
    const x1 = data.x1 * drawingCanvas.width;
    const y1 = data.y1 * drawingCanvas.height;
    
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
});

socket.on('new_guess', (data) => {
    const guessElement = document.createElement('p');
    guessElement.textContent = `${data.player_name}: ${data.guess}`;
    guessesList.appendChild(guessElement);
    
    // Scroll to the bottom of the guesses list
    guessesList.scrollTop = guessesList.scrollHeight;
});

socket.on('correct_guess', (data) => {
    const guessElement = document.createElement('p');
    guessElement.textContent = `${data.player_name} guessed correctly!`;
    guessElement.style.color = '#27ae60';
    guessElement.style.fontWeight = 'bold';
    guessesList.appendChild(guessElement);
    
    // Update scores in real-time
    updateScores(data.scores);
});

socket.on('round_ended', (data) => {
    // Stop the timer
    clearInterval(countdownInterval);
    
    // Show round summary
    gameScreen.classList.add('hidden');
    roundSummary.classList.remove('hidden');
    
    // Update summary information
    revealWordSpan.textContent = data.word;
    
    // Update correct guessers list
    let guessersHTML = '';
    if (data.correct_guessers.length > 0) {
        guessersHTML = '<p>Correct guessers:</p><ul>';
        data.correct_guessers.forEach(name => {
            guessersHTML += `<li>${name}</li>`;
        });
        guessersHTML += '</ul>';
    } else {
        if (data.timeout) {
            guessersHTML = '<p>Time ran out! No one guessed correctly.</p>';
        } else if (data.skipped) {
            guessersHTML = '<p>The drawer skipped this word.</p>';
        } else {
            guessersHTML = '<p>No one guessed correctly.</p>';
        }
    }
    correctGuessersDiv.innerHTML = guessersHTML;
    
    // Update scores
    updateScores(data.scores);
    
    // Start countdown for next round
    startNextRoundCountdown();
});

socket.on('error', (data) => {
    alert(data.message);
});

// Helper functions
function updatePlayersList(players) {
    playersList.innerHTML = '';
    players.forEach(name => {
        const li = document.createElement('li');
        li.textContent = name;
        playersList.appendChild(li);
    });
}

function updateScores(scores) {
    scoresList.innerHTML = '';
    scores.sort((a, b) => b.score - a.score);
    
    scores.forEach(player => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${player.name}</span><span>${player.score} points</span>`;
        scoresList.appendChild(li);
    });
}

function startTimer(seconds) {
    clearInterval(countdownInterval);
    timerDiv.textContent = seconds;
    
    countdownInterval = setInterval(() => {
        seconds--;
        timerDiv.textContent = seconds;
        
        if (seconds <= 0) {
            clearInterval(countdownInterval);
        }
    }, 1000);
}

function startNextRoundCountdown() {
    let seconds = 5;
    countdownSpan.textContent = seconds;
    
    countdownInterval = setInterval(() => {
        seconds--;
        countdownSpan.textContent = seconds;
        
        if (seconds <= 0) {
            clearInterval(countdownInterval);
        }
    }, 1000);
}

// Initialize on load
window.onload = function() {
    // Set default color
    colorBtns[0].classList.add('active');
}; 