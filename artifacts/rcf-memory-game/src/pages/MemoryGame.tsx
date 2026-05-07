import { useState, useEffect, useCallback, useRef } from "react";

interface CardData {
  id: number;
  pairId: number;
  emoji: string;
  label: string;
  isFlipped: boolean;
  isMatched: boolean;
}

const ALL_CARD_TYPES = [
  { pairId: 0, emoji: "❄️", label: "Refrigeration" },
  { pairId: 1, emoji: "🔥", label: "Heating" },
  { pairId: 2, emoji: "🏠", label: "Home Appliances" },
  { pairId: 3, emoji: "🔧", label: "Maintenance" },
  { pairId: 4, emoji: "⚙️", label: "Spare Parts" },
  { pairId: 5, emoji: "🚛", label: "Distribution" },
  { pairId: 6, emoji: "🌡️", label: "Temperature" },
  { pairId: 7, emoji: "⭐", label: "Quality" },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(round: number): CardData[] {
  const pairCount = Math.min(4 + (round - 1) * 2, ALL_CARD_TYPES.length);
  const chosen = ALL_CARD_TYPES.slice(0, pairCount);
  const doubled = [...chosen, ...chosen];
  const shuffled = shuffle(doubled);
  return shuffled.map((c, i) => ({
    id: i,
    pairId: c.pairId,
    emoji: c.emoji,
    label: c.label,
    isFlipped: false,
    isMatched: false,
  }));
}

function getTimeLimit(round: number): number {
  return Math.max(30, 90 - (round - 1) * 10);
}

type GamePhase = "menu" | "playing" | "roundWin" | "timeUp" | "gameOver";

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  duration: number;
  delay: number;
  size: number;
}

function Confetti({ active }: { active: boolean }) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  useEffect(() => {
    if (!active) { setPieces([]); return; }
    const colors = ["#f57c00", "#ff9800", "#ffffff", "#1a237e", "#ffd740", "#ff5722"];
    const newPieces = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: 2 + Math.random() * 2,
      delay: Math.random() * 1.5,
      size: 8 + Math.random() * 8,
    }));
    setPieces(newPieces);
  }, [active]);

  if (!active || pieces.length === 0) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute confetti-piece rounded-sm"
          style={{
            left: `${p.x}%`,
            top: "-20px",
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function CardBack() {
  return (
    <div
      className="card-face card-back w-full h-full flex flex-col items-center justify-center rounded-xl"
      style={{ backgroundColor: "#1a237e", border: "2px solid rgba(245,124,0,0.5)" }}
    >
      <img
        src="/rcf-logo.png"
        alt="RCF"
        className="w-12 h-12 object-contain opacity-90"
      />
      <div
        className="mt-1 text-xs font-black tracking-widest"
        style={{ color: "#f57c00", fontSize: "9px" }}
      >
        RCF THE BEST
      </div>
    </div>
  );
}

function CardFront({ emoji, label, matched }: { emoji: string; label: string; matched: boolean }) {
  return (
    <div
      className={`card-face card-front w-full h-full flex flex-col items-center justify-center rounded-xl transition-all ${matched ? "card-matched" : ""}`}
      style={{
        backgroundColor: matched ? "#fff8f0" : "#ffffff",
        border: matched ? "2px solid #f57c00" : "2px solid #e0e0e0",
      }}
    >
      <div className="text-3xl sm:text-4xl leading-none">{emoji}</div>
      <div
        className="mt-2 text-center font-semibold px-1 leading-tight"
        style={{ color: "#1a237e", fontSize: "10px" }}
      >
        {label}
      </div>
      {matched && (
        <div
          className="absolute top-1 right-1 text-xs font-bold"
          style={{ color: "#f57c00" }}
        >
          ✓
        </div>
      )}
    </div>
  );
}

interface CardProps {
  card: CardData;
  onClick: () => void;
  disabled: boolean;
}

function Card({ card, onClick, disabled }: CardProps) {
  const canClick = !card.isFlipped && !card.isMatched && !disabled;
  return (
    <div
      className={`card-scene card-hover ${card.isMatched ? "matched-card" : ""}`}
      style={{ width: "100%", aspectRatio: "1 / 1.3", cursor: canClick ? "pointer" : "default" }}
      onClick={canClick ? onClick : undefined}
    >
      <div className={`card-inner ${card.isFlipped || card.isMatched ? "flipped" : ""}`}>
        <CardBack />
        <CardFront emoji={card.emoji} label={card.label} matched={card.isMatched} />
      </div>
    </div>
  );
}

function Timer({ timeLeft, totalTime }: { timeLeft: number; totalTime: number }) {
  const pct = (timeLeft / totalTime) * 100;
  const urgent = timeLeft <= 10;
  const color = urgent ? "#ff1744" : timeLeft <= 20 ? "#f57c00" : "#4caf50";

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`text-3xl font-black tabular-nums ${urgent ? "timer-urgent" : ""}`}
        style={{ color: urgent ? "#ff1744" : "#f57c00" }}
      >
        {String(Math.floor(timeLeft / 60)).padStart(2, "0")}:{String(timeLeft % 60).padStart(2, "0")}
      </div>
      <div className="w-32 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function MemoryGame() {
  const [phase, setPhase] = useState<GamePhase>("menu");
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [cards, setCards] = useState<CardData[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [moves, setMoves] = useState(0);
  const [matchesFound, setMatchesFound] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [locked, setLocked] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRound = useCallback((r: number) => {
    clearTimer();
    const deck = buildDeck(r);
    const time = getTimeLimit(r);
    setCards(deck);
    setFlipped([]);
    setLocked(false);
    setTimeLeft(time);
    setTotalTime(time);
    setMoves(0);
    setMatchesFound(0);
    setPhase("playing");
    setShowConfetti(false);
  }, [clearTimer]);

  const startGame = useCallback(() => {
    setRound(1);
    setScore(0);
    startRound(1);
  }, [startRound]);

  useEffect(() => {
    if (phase !== "playing") return;
    clearTimer();
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearTimer();
          setPhase("timeUp");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return clearTimer;
  }, [phase, clearTimer]);

  const handleCardClick = useCallback(
    (id: number) => {
      if (locked || phase !== "playing") return;
      const card = cards.find((c) => c.id === id);
      if (!card || card.isFlipped || card.isMatched) return;
      if (flipped.length === 1 && flipped[0] === id) return;

      const newFlipped = [...flipped, id];
      setCards((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isFlipped: true } : c))
      );

      if (newFlipped.length === 2) {
        setLocked(true);
        setMoves((m) => m + 1);
        const [a, b] = newFlipped.map((fid) => cards.find((c) => c.id === fid)!);
        if (a.pairId === b.pairId) {
          const bonusPoints = Math.max(10, timeLeft);
          setScore((s) => s + bonusPoints);
          setMatchesFound((mf) => {
            const newMF = mf + 1;
            const totalPairs = Math.min(4 + (round - 1) * 2, ALL_CARD_TYPES.length);
            setTimeout(() => {
              setCards((prev) =>
                prev.map((c) =>
                  c.id === newFlipped[0] || c.id === newFlipped[1]
                    ? { ...c, isMatched: true, isFlipped: true }
                    : c
                )
              );
              setFlipped([]);
              setLocked(false);
              if (newMF === totalPairs) {
                clearTimer();
                setShowConfetti(true);
                setTimeout(() => {
                  setPhase("roundWin");
                  setShowConfetti(false);
                }, 1800);
              }
            }, 300);
            return newMF;
          });
        } else {
          setTimeout(() => {
            setCards((prev) =>
              prev.map((c) =>
                newFlipped.includes(c.id) ? { ...c, isFlipped: false } : c
              )
            );
            setFlipped([]);
            setLocked(false);
          }, 900);
        }
        setFlipped(newFlipped);
      } else {
        setFlipped(newFlipped);
      }
    },
    [cards, flipped, locked, phase, timeLeft, round, clearTimer]
  );

  const pairCount = Math.min(4 + (round - 1) * 2, ALL_CARD_TYPES.length);
  const cols = pairCount <= 4 ? 4 : pairCount <= 6 ? 4 : 4;

  return (
    <div
      className="min-h-screen bg-pattern flex flex-col"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <Confetti active={showConfetti} />

      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3"
        style={{ backgroundColor: "rgba(0,0,0,0.25)", borderBottom: "1px solid rgba(245,124,0,0.3)" }}
      >
        <div className="flex items-center gap-3">
          <img src="/rcf-logo.png" alt="RCF" className="w-10 h-10 object-contain" />
          <div>
            <div className="font-black text-white text-lg leading-none tracking-wide">RCF</div>
            <div className="text-xs font-semibold tracking-widest" style={{ color: "#f57c00" }}>THE BEST</div>
          </div>
        </div>
        <div className="text-center text-white font-black text-sm tracking-widest uppercase opacity-70 hidden sm:block">
          Memory Challenge
        </div>
        {phase !== "menu" && (
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-xs text-white opacity-60 uppercase tracking-wider">Score</div>
              <div className="font-black text-xl" style={{ color: "#f57c00" }}>{score}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-white opacity-60 uppercase tracking-wider">Round</div>
              <div className="font-black text-xl text-white">{round}</div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">

        {/* MENU */}
        {phase === "menu" && (
          <div className="text-center max-w-md mx-auto">
            <img src="/rcf-logo.png" alt="RCF Logo" className="w-32 h-32 object-contain mx-auto mb-4" />
            <h1 className="text-4xl font-black text-white mb-1 tracking-tight">Memory Challenge</h1>
            <p className="font-bold tracking-widest mb-2" style={{ color: "#f57c00" }}>RCF — EL RIDWANE CHAUD & FROID</p>
            <p className="text-white opacity-70 text-sm mb-8">
              Match pairs of HVAC icons before time runs out!<br />
              Each round adds more pairs and less time.
            </p>
            <div className="grid grid-cols-4 gap-3 mb-8">
              {ALL_CARD_TYPES.slice(0, 8).map((c) => (
                <div
                  key={c.pairId}
                  className="flex flex-col items-center justify-center rounded-xl p-3"
                  style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(245,124,0,0.3)" }}
                >
                  <span className="text-2xl">{c.emoji}</span>
                  <span className="text-white text-xs mt-1 opacity-70 text-center leading-tight">{c.label}</span>
                </div>
              ))}
            </div>
            <button
              onClick={startGame}
              className="px-10 py-4 rounded-2xl font-black text-white text-xl tracking-wider uppercase transition-all hover:scale-105 active:scale-95 shadow-lg"
              style={{ backgroundColor: "#f57c00", boxShadow: "0 4px 20px rgba(245,124,0,0.5)" }}
            >
              Start Game
            </button>
          </div>
        )}

        {/* PLAYING */}
        {phase === "playing" && (
          <div className="w-full max-w-2xl mx-auto">
            {/* Timer + stats bar */}
            <div
              className="flex items-center justify-between mb-4 px-4 py-3 rounded-2xl"
              style={{ backgroundColor: "rgba(0,0,0,0.25)", border: "1px solid rgba(245,124,0,0.2)" }}
            >
              <div className="text-center">
                <div className="text-xs text-white opacity-60 uppercase tracking-wider">Pairs</div>
                <div className="font-black text-white text-lg">
                  {matchesFound}/{pairCount}
                </div>
              </div>
              <Timer timeLeft={timeLeft} totalTime={totalTime} />
              <div className="text-center">
                <div className="text-xs text-white opacity-60 uppercase tracking-wider">Moves</div>
                <div className="font-black text-white text-lg">{moves}</div>
              </div>
            </div>

            {/* Card grid */}
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
            >
              {cards.map((card) => (
                <Card
                  key={card.id}
                  card={card}
                  onClick={() => handleCardClick(card.id)}
                  disabled={locked}
                />
              ))}
            </div>
          </div>
        )}

        {/* ROUND WIN */}
        {phase === "roundWin" && (
          <div className="text-center celebration-enter max-w-sm mx-auto">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-4xl font-black text-white mb-2">Round {round} Complete!</h2>
            <p className="font-semibold mb-1" style={{ color: "#f57c00" }}>
              Matched in {moves} moves • Time left: {timeLeft}s
            </p>
            <div
              className="text-5xl font-black my-4"
              style={{ color: "#f57c00" }}
            >
              +{score} pts
            </div>
            {round < ALL_CARD_TYPES.length && (
              <p className="text-white opacity-70 text-sm mb-6">
                Next round: {Math.min(4 + round * 2, ALL_CARD_TYPES.length * 2)} cards • {getTimeLimit(round + 1)}s timer
              </p>
            )}
            <div className="flex gap-3 justify-center">
              {round < ALL_CARD_TYPES.length ? (
                <button
                  onClick={() => {
                    const nextRound = round + 1;
                    setRound(nextRound);
                    startRound(nextRound);
                  }}
                  className="px-8 py-3 rounded-xl font-black text-white text-lg uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
                  style={{ backgroundColor: "#f57c00", boxShadow: "0 4px 20px rgba(245,124,0,0.4)" }}
                >
                  Next Round →
                </button>
              ) : (
                <button
                  onClick={() => setPhase("gameOver")}
                  className="px-8 py-3 rounded-xl font-black text-white text-lg uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
                  style={{ backgroundColor: "#f57c00", boxShadow: "0 4px 20px rgba(245,124,0,0.4)" }}
                >
                  See Results
                </button>
              )}
              <button
                onClick={startGame}
                className="px-6 py-3 rounded-xl font-semibold text-white uppercase tracking-wider transition-all hover:scale-105"
                style={{ backgroundColor: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}
              >
                Restart
              </button>
            </div>
          </div>
        )}

        {/* TIME UP */}
        {phase === "timeUp" && (
          <div className="text-center celebration-enter max-w-sm mx-auto">
            <div className="text-6xl mb-4">⏰</div>
            <h2 className="text-4xl font-black text-white mb-2">Time's Up!</h2>
            <p className="text-white opacity-70 mb-4">
              You found {matchesFound} of {pairCount} pairs on Round {round}
            </p>
            <div className="text-3xl font-black mb-6" style={{ color: "#f57c00" }}>
              Score: {score}
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={startGame}
                className="px-8 py-3 rounded-xl font-black text-white text-lg uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
                style={{ backgroundColor: "#f57c00", boxShadow: "0 4px 20px rgba(245,124,0,0.4)" }}
              >
                Try Again
              </button>
              <button
                onClick={() => setPhase("menu")}
                className="px-6 py-3 rounded-xl font-semibold text-white uppercase tracking-wider transition-all hover:scale-105"
                style={{ backgroundColor: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}
              >
                Menu
              </button>
            </div>
          </div>
        )}

        {/* GAME OVER (all rounds beaten) */}
        {phase === "gameOver" && (
          <div className="text-center celebration-enter max-w-sm mx-auto">
            <img src="/rcf-logo.png" alt="RCF" className="w-20 h-20 object-contain mx-auto mb-4" />
            <h2 className="text-4xl font-black text-white mb-1">Champion!</h2>
            <p className="font-bold tracking-widest mb-4" style={{ color: "#f57c00" }}>
              RCF THE BEST
            </p>
            <p className="text-white opacity-70 mb-4">
              You completed all {ALL_CARD_TYPES.length} rounds!
            </p>
            <div
              className="text-5xl font-black mb-6"
              style={{ color: "#f57c00" }}
            >
              {score} pts
            </div>
            <div className="flex gap-2 justify-center mb-4">
              {[1, 2, 3].map((s) => (
                <div key={s} className="text-4xl star-pop" style={{ animationDelay: `${s * 0.15}s` }}>
                  ⭐
                </div>
              ))}
            </div>
            <button
              onClick={startGame}
              className="px-10 py-4 rounded-2xl font-black text-white text-xl tracking-wider uppercase transition-all hover:scale-105 active:scale-95 shadow-lg"
              style={{ backgroundColor: "#f57c00", boxShadow: "0 4px 20px rgba(245,124,0,0.5)" }}
            >
              Play Again
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        className="text-center py-3 text-xs"
        style={{ color: "rgba(255,255,255,0.35)", borderTop: "1px solid rgba(245,124,0,0.15)" }}
      >
        El Ridwane Chaud & Froid — RCF THE BEST
      </footer>
    </div>
  );
}
