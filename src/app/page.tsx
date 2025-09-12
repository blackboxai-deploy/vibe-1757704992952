"use client";

import SnakeGame from "@/components/SnakeGame";

export default function HomePage() {
  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
      <div className="w-full max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-green-400 mb-2 tracking-wider">
            SNAKE
          </h1>
          <p className="text-gray-300 text-lg">
            Classic arcade gaming experience
          </p>
        </div>
        <SnakeGame />
      </div>
    </main>
  );
}