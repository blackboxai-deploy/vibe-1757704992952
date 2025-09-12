"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

// Game constants
const GRID_SIZE = 20;
const CANVAS_SIZE = 600;
const CELL_SIZE = CANVAS_SIZE / GRID_SIZE;
const INITIAL_SPEED = 150;
const SPEED_INCREASE = 5;
const MIN_SPEED = 80;

// Game types
type Position = { x: number; y: number };
type Direction = { x: number; y: number };
type GameState = "menu" | "playing" | "paused" | "gameOver";
type FoodType = "normal" | "bonus";

interface Food {
  position: Position;
  type: FoodType;
  points: number;
  timeLeft?: number;
}

// Game entity classes
class Snake {
  body: Position[] = [{ x: 10, y: 10 }];
  direction: Direction = { x: 1, y: 0 };
  nextDirection: Direction = { x: 1, y: 0 };

  move(): void {
    this.direction = { ...this.nextDirection };
    const head = { ...this.body[0] };
    head.x += this.direction.x;
    head.y += this.direction.y;
    this.body.unshift(head);
  }

  grow(): void {
    // Don't remove tail segment to grow
  }

  shrink(): void {
    this.body.pop();
  }

  checkSelfCollision(): boolean {
    const head = this.body[0];
    return this.body.slice(1).some(segment => 
      segment.x === head.x && segment.y === head.y
    );
  }

  checkBoundaryCollision(): boolean {
    const head = this.body[0];
    return head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE;
  }

  reset(): void {
    this.body = [{ x: 10, y: 10 }];
    this.direction = { x: 1, y: 0 };
    this.nextDirection = { x: 1, y: 0 };
  }

  setDirection(newDirection: Direction): void {
    // Prevent reversing into body
    if (this.direction.x !== -newDirection.x || this.direction.y !== -newDirection.y) {
      this.nextDirection = newDirection;
    }
  }
}

class GameBoard {
  static generateRandomPosition(snake: Snake): Position {
    let position: Position;
    do {
      position = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
      };
    } while (snake.body.some(segment => segment.x === position.x && segment.y === position.y));
    return position;
  }

  static checkCollision(pos1: Position, pos2: Position): boolean {
    return pos1.x === pos2.x && pos1.y === pos2.y;
  }
}

// Audio manager
class AudioManager {
  private context: AudioContext | null = null;
  private enabled = true;

  constructor() {
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      this.context = new AudioContext();
    }
  }

  private createTone(frequency: number, duration: number, type: OscillatorType = 'sine'): void {
    if (!this.context || !this.enabled) return;

    try {
      const oscillator = this.context.createOscillator();
      const gainNode = this.context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.context.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;

      gainNode.gain.setValueAtTime(0.3, this.context.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + duration);

      oscillator.start(this.context.currentTime);
      oscillator.stop(this.context.currentTime + duration);
    } catch (error) {
      console.warn('Audio playback failed:', error);
    }
  }

  playEat(): void {
    this.createTone(800, 0.1, 'square');
  }

  playBonus(): void {
    this.createTone(1200, 0.2, 'sawtooth');
  }

  playGameOver(): void {
    this.createTone(200, 0.5, 'triangle');
  }

  playLevelUp(): void {
    this.createTone(1000, 0.3, 'sine');
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}

export default function SnakeGame() {
  // Game state
  const [gameState, setGameState] = useState<GameState>("menu");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const [food, setFood] = useState<Food | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const snakeRef = useRef(new Snake());
  const audioManagerRef = useRef(new AudioManager());

  // Load high score on mount
  useEffect(() => {
    const savedHighScore = localStorage.getItem("snakeHighScore");
    if (savedHighScore) {
      setHighScore(parseInt(savedHighScore));
    }
  }, []);

  // Save high score when it changes
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem("snakeHighScore", score.toString());
    }
  }, [score, highScore]);

  // Generate food
  const generateFood = useCallback((): Food => {
    const isBonus = Math.random() < 0.1; // 10% chance for bonus food
    return {
      position: GameBoard.generateRandomPosition(snakeRef.current),
      type: isBonus ? "bonus" : "normal",
      points: isBonus ? 50 : 10,
      timeLeft: isBonus ? 100 : undefined, // Bonus food disappears after ~10 seconds
    };
  }, []);

  // Initialize game
  const initGame = useCallback(() => {
    snakeRef.current.reset();
    setScore(0);
    setLevel(1);
    setSpeed(INITIAL_SPEED);
    setFood(generateFood());
    setGameState("playing");
  }, [generateFood]);

  // Handle input
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (gameState !== "playing") {
      if (event.key === " " || event.key === "Enter") {
        if (gameState === "menu" || gameState === "gameOver") {
          initGame();
        } else if (gameState === "paused") {
          setGameState("playing");
        }
      }
      return;
    }

    // Pause game
    if (event.key === " ") {
      setGameState("paused");
      return;
    }

    // Direction controls
    const directions: { [key: string]: Direction } = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      KeyW: { x: 0, y: -1 },
      KeyS: { x: 0, y: 1 },
      KeyA: { x: -1, y: 0 },
      KeyD: { x: 1, y: 0 },
    };

    const direction = directions[event.code];
    if (direction) {
      event.preventDefault();
      snakeRef.current.setDirection(direction);
    }
  }, [gameState, initGame]);

  // Touch controls
  const touchStartRef = useRef<Position>({ x: 0, y: 0 });

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    if (gameState !== "playing") {
      if (gameState === "menu" || gameState === "gameOver") {
        initGame();
      } else if (gameState === "paused") {
        setGameState("playing");
      }
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    const minSwipeDistance = 30;
    if (Math.abs(deltaX) < minSwipeDistance && Math.abs(deltaY) < minSwipeDistance) {
      setGameState("paused");
      return;
    }

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Horizontal swipe
      snakeRef.current.setDirection(deltaX > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 });
    } else {
      // Vertical swipe
      snakeRef.current.setDirection(deltaY > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 });
    }
  }, [gameState, initGame]);

  // Game update logic
  const updateGame = useCallback(() => {
    const snake = snakeRef.current;
    
    // Move snake
    snake.move();

    // Check collisions
    if (snake.checkBoundaryCollision() || snake.checkSelfCollision()) {
      audioManagerRef.current.playGameOver();
      setGameState("gameOver");
      return;
    }

    let shouldGrow = false;
    let points = 0;

    // Check food collision
    if (food && GameBoard.checkCollision(snake.body[0], food.position)) {
      shouldGrow = true;
      points = food.points;
      
      if (food.type === "bonus") {
        audioManagerRef.current.playBonus();
      } else {
        audioManagerRef.current.playEat();
      }

      setScore(prev => prev + points);
      setFood(generateFood());
    }

    // Update food timer for bonus food
    if (food && food.type === "bonus" && food.timeLeft !== undefined) {
      if (food.timeLeft <= 0) {
        setFood(generateFood());
      } else {
        setFood(prev => prev ? { ...prev, timeLeft: (prev.timeLeft || 0) - 1 } : null);
      }
    }

    // Handle growth
    if (shouldGrow) {
      snake.grow();
    } else {
      snake.shrink();
    }

    // Level progression
    const newLevel = Math.floor(score / 100) + 1;
    if (newLevel > level) {
      setLevel(newLevel);
      setSpeed(Math.max(MIN_SPEED, INITIAL_SPEED - (newLevel - 1) * SPEED_INCREASE));
      audioManagerRef.current.playLevelUp();
    }
  }, [food, score, level, generateFood]);

  // Game loop
  const gameLoop = useCallback((currentTime: number) => {
    if (gameState !== "playing") {
      return;
    }

    if (currentTime - lastTimeRef.current >= speed) {
      updateGame();
      lastTimeRef.current = currentTime;
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, speed, updateGame]);

  // Start/stop game loop
  useEffect(() => {
    if (gameState === "playing") {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    } else {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    }

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, gameLoop]);

  // Event listeners
  useEffect(() => {
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handleKeyPress]);

  // Rendering
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw grid
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      const pos = i * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, CANVAS_SIZE);
      ctx.moveTo(0, pos);
      ctx.lineTo(CANVAS_SIZE, pos);
      ctx.stroke();
    }

    // Draw snake
    const snake = snakeRef.current;
    snake.body.forEach((segment, index) => {
      ctx.fillStyle = index === 0 ? "#10b981" : "#22c55e"; // Head darker, body lighter
      ctx.fillRect(
        segment.x * CELL_SIZE + 1,
        segment.y * CELL_SIZE + 1,
        CELL_SIZE - 2,
        CELL_SIZE - 2
      );
    });

    // Draw food
    if (food) {
      const { position, type } = food;
      
      if (type === "bonus") {
        // Animated bonus food
        const pulse = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`;
        ctx.fillRect(
          position.x * CELL_SIZE + 2,
          position.y * CELL_SIZE + 2,
          CELL_SIZE - 4,
          CELL_SIZE - 4
        );
        
        // Draw timer indicator
        if (food.timeLeft !== undefined) {
          const timePercent = food.timeLeft / 100;
          ctx.fillStyle = "#ff4444";
          ctx.fillRect(
            position.x * CELL_SIZE + 2,
            position.y * CELL_SIZE + CELL_SIZE - 4,
            (CELL_SIZE - 4) * timePercent,
            2
          );
        }
      } else {
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(
          position.x * CELL_SIZE + 3,
          position.y * CELL_SIZE + 3,
          CELL_SIZE - 6,
          CELL_SIZE - 6
        );
      }
    }
  }, [food]);

  // Render loop
  useEffect(() => {
    const renderLoop = () => {
      draw();
      requestAnimationFrame(renderLoop);
    };
    renderLoop();
  }, [draw]);

  const toggleSound = () => {
    const enabled = audioManagerRef.current.toggle();
    setSoundEnabled(enabled);
  };

  return (
    <div className="flex flex-col items-center space-y-6">
      {/* Game Stats */}
      <div className="flex flex-wrap justify-center gap-6 text-white">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-400">{score}</div>
          <div className="text-sm text-gray-400">Score</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-400">{level}</div>
          <div className="text-sm text-gray-400">Level</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-400">{highScore}</div>
          <div className="text-sm text-gray-400">High Score</div>
        </div>
      </div>

      {/* Game Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="border-2 border-gray-600 rounded-lg shadow-2xl bg-gray-800"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ touchAction: "none" }}
        />

        {/* Game State Overlays */}
        {gameState === "menu" && (
          <div className="absolute inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center text-white rounded-lg">
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-bold text-green-400">Ready to Play?</h2>
              <div className="text-lg space-y-2">
                <p>Use arrow keys or WASD to move</p>
                <p>Eat red food to grow and score</p>
                <p>Golden food = 50 points (limited time!)</p>
                <p>Avoid walls and yourself</p>
              </div>
              <div className="text-xl font-semibold text-yellow-400">
                Press SPACE or TAP to start
              </div>
            </div>
          </div>
        )}

        {gameState === "paused" && (
          <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center text-white rounded-lg">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold text-yellow-400">Paused</h2>
              <div className="text-xl">Press SPACE or TAP to continue</div>
            </div>
          </div>
        )}

        {gameState === "gameOver" && (
          <div className="absolute inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center text-white rounded-lg">
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-bold text-red-400">Game Over!</h2>
              <div className="text-xl">Final Score: <span className="text-green-400 font-bold">{score}</span></div>
              {score === highScore && (
                <div className="text-lg text-yellow-400 font-semibold">🎉 New High Score! 🎉</div>
              )}
              <div className="text-lg">Level Reached: <span className="text-blue-400">{level}</span></div>
              <div className="text-xl font-semibold text-green-400 mt-6">
                Press SPACE or TAP to play again
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap justify-center gap-4 text-white">
        <button
          onClick={toggleSound}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          Sound: {soundEnabled ? "ON" : "OFF"}
        </button>
        
        {gameState === "playing" && (
          <button
            onClick={() => setGameState("paused")}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg transition-colors"
          >
            Pause
          </button>
        )}
      </div>

      {/* Mobile Instructions */}
      <div className="text-center text-gray-400 text-sm max-w-md lg:hidden">
        <p>Swipe to move • Tap to pause/unpause • Tap overlay to start</p>
      </div>
    </div>
  );
}