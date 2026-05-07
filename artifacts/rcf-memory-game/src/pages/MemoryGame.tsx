import { useState, useEffect, useCallback, useRef } from "react";

/* ══════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════ */
const JOKER_PAIR_ID = -1;
const PEEK_SECONDS = 4;

const ALL_CARD_TYPES = [
  { pairId: 0,  emoji: "❄️",  label: "Refrigeration" },
  { pairId: 1,  emoji: "🔥",  label: "Heating" },
  { pairId: 2,  emoji: "🏠",  label: "Home Appliances" },
  { pairId: 3,  emoji: "🔧",  label: "Maintenance" },
  { pairId: 4,  emoji: "⚙️",  label: "Spare Parts" },
  { pairId: 5,  emoji: "🚛",  label: "Distribution" },
  { pairId: 6,  emoji: "🌡️",  label: "Temperature" },
  { pairId: 7,  emoji: "⭐",  label: "Quality" },
  { pairId: 8,  emoji: "🌬️",  label: "Air Flow" },
  { pairId: 9,  emoji: "💧",  label: "Water Heat" },
  { pairId: 10, emoji: "🔌",  label: "Electrical" },
  { pairId: 11, emoji: "🛠️",  label: "Installation" },
  { pairId: 12, emoji: "📦",  label: "Packaging" },
  { pairId: 13, emoji: "💡",  label: "Energy" },
];

const JOKER_CARD = { pairId: JOKER_PAIR_ID, emoji: "🃏", label: "Joker" };

/* ══════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════ */
interface CardData {
  id: number;
  pairId: number;
  emoji: string;
  label: string;
  isFlipped: boolean;
  isMatched: boolean;
  isJoker: boolean;
}

interface ScoreEntry {
  id: number;
  nickname: string;
  score: number;
  round: number;
  createdAt: string;
}

type GamePhase = "menu" | "nickname" | "peek" | "playing" | "roundWin" | "timeUp" | "gameOver";

/* ══════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════ */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getPairCount(round: number) {
  return Math.min(4 + (round - 1) * 2, ALL_CARD_TYPES.length);
}

function buildDeck(round: number, faceUp = false): CardData[] {
  const pairCount = getPairCount(round);
  // Random selection each round
  const shuffledTypes = shuffle(ALL_CARD_TYPES).slice(0, pairCount);
  const doubled = [...shuffledTypes, ...shuffledTypes, JOKER_CARD, JOKER_CARD];
  return shuffle(doubled).map((c, i) => ({
    id: i,
    pairId: c.pairId,
    emoji: c.emoji,
    label: c.label,
    isFlipped: faceUp,
    isMatched: false,
    isJoker: c.pairId === JOKER_PAIR_ID,
  }));
}

function getTimeLimit(round: number): number {
  return Math.max(30, 90 - (round - 1) * 10);
}

function getCols(total: number): number {
  if (total <= 10) return 5;
  if (total <= 18) return 5;
  return 6;
}

/* ══════════════════════════════════════════════
   API
══════════════════════════════════════════════ */
async function fetchScores(): Promise<ScoreEntry[]> {
  try {
    const res = await fetch("/api/scores?limit=10");
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

async function postScore(nickname: string, score: number, round: number): Promise<void> {
  try {
    await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, score, round }),
    });
  } catch { /* silent */ }
}

/* ══════════════════════════════════════════════
   CONFETTI
══════════════════════════════════════════════ */
function Confetti({ active }: { active: boolean }) {
  const [pieces, setPieces] = useState<{ id: number; x: number; color: string; dur: number; delay: number; size: number }[]>([]);
  useEffect(() => {
    if (!active) { setPieces([]); return; }
    const colors = ["#f57c00", "#ff9800", "#1a237e", "#ffd740", "#ff5722", "#4caf50", "#e91e63"];
    setPieces(Array.from({ length: 60 }, (_, i) => ({
      id: i, x: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      dur: 2 + Math.random() * 2, delay: Math.random() * 1.5, size: 7 + Math.random() * 9,
    })));
  }, [active]);
  if (!active || pieces.length === 0) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map(p => (
        <div key={p.id} className="absolute confetti-piece rounded-sm"
          style={{ left: `${p.x}%`, top: "-20px", width: p.size, height: p.size, backgroundColor: p.color, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }} />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════
   CARD COMPONENTS
══════════════════════════════════════════════ */
function CardBack() {
  return (
    <div className="card-face card-back w-full h-full flex flex-col items-center justify-center rounded-2xl hero-gradient"
      style={{ border: "2px solid rgba(245,124,0,0.4)" }}>
      <img src="/rcf-logo.png" alt="RCF" className="w-8 h-8 object-contain opacity-90" />
      <div className="mt-0.5 font-black tracking-widest" style={{ color: "#f57c00", fontSize: "7px" }}>RCF THE BEST</div>
    </div>
  );
}

function CardFront({ emoji, label, matched, isJoker, peeking }: {
  emoji: string; label: string; matched: boolean; isJoker: boolean; peeking?: boolean;
}) {
  return (
    <div className={`card-face card-front w-full h-full flex flex-col items-center justify-center rounded-2xl relative ${matched ? "card-matched-anim" : ""}`}
      style={{
        backgroundColor: isJoker ? (matched ? "#fff0ff" : "#fdf0ff") : matched ? "#fff8f0" : "#fff",
        border: isJoker ? `2.5px solid ${matched ? "#9c27b0" : "#ce93d8"}` : matched ? "2.5px solid #f57c00" : "2px solid #e8eaf0",
        boxShadow: isJoker ? "0 4px 20px rgba(156,39,176,0.18)" : matched ? "0 4px 20px rgba(245,124,0,0.18)" : "0 2px 8px rgba(26,35,126,0.07)",
        outline: peeking && !matched ? "2px solid rgba(245,124,0,0.4)" : "none",
      }}>
      {isJoker && (
        <div className="absolute top-1 left-1.5 text-purple-500 font-black" style={{ fontSize: "8px" }}>WILD</div>
      )}
      <span className="text-2xl sm:text-3xl leading-none">{emoji}</span>
      <span className="mt-1 font-bold px-1 text-center leading-tight" style={{ color: isJoker ? "#9c27b0" : "#1a237e", fontSize: "8px" }}>{label}</span>
      {matched && <span className="absolute top-1.5 right-1.5 font-black" style={{ color: isJoker ? "#9c27b0" : "#f57c00", fontSize: "9px" }}>✓</span>}
    </div>
  );
}

function MemoryCard({ card, onClick, disabled, peeking }: {
  card: CardData; onClick: () => void; disabled: boolean; peeking?: boolean;
}) {
  const canClick = !card.isFlipped && !card.isMatched && !disabled && !peeking;
  return (
    <div
      className={`card-scene ${!peeking ? "card-hover" : ""} ${card.isMatched ? "matched-card" : ""}`}
      style={{ width: "100%", aspectRatio: "1 / 1.2", cursor: canClick ? "pointer" : "default" }}
      onClick={canClick ? onClick : undefined}
    >
      <div className={`card-inner ${card.isFlipped || card.isMatched || peeking ? "flipped" : ""}`}>
        <CardBack />
        <CardFront emoji={card.emoji} label={card.label} matched={card.isMatched} isJoker={card.isJoker} peeking={peeking} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   TIMER
══════════════════════════════════════════════ */
function Timer({ timeLeft, totalTime }: { timeLeft: number; totalTime: number }) {
  const pct = (timeLeft / totalTime) * 100;
  const urgent = timeLeft <= 10;
  const barColor = urgent ? "#ff1744" : timeLeft <= 20 ? "#f57c00" : "#1a237e";
  return (
    <div className="flex flex-col items-center gap-1 min-w-[90px]">
      <div className={`text-3xl font-black tabular-nums ${urgent ? "timer-urgent" : ""}`}
        style={{ color: urgent ? "#ff1744" : "#1a237e" }}>
        {String(Math.floor(timeLeft / 60)).padStart(2, "0")}:{String(timeLeft % 60).padStart(2, "0")}
      </div>
      <div className="w-20 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#e8eaf0" }}>
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   STAT PILL
══════════════════════════════════════════════ */
function StatPill({ label, value, accent, purple }: { label: string; value: string | number; accent?: boolean; purple?: boolean }) {
  const bg = purple ? "#f5f0ff" : accent ? "#fff8f0" : "#f0f3ff";
  const color = purple ? "#9c27b0" : accent ? "#f57c00" : "#1a237e";
  const labelColor = purple ? "#ba68c8" : accent ? "#f57c00" : "#5c6bc0";
  return (
    <div className="flex flex-col items-center px-3 py-2 rounded-2xl" style={{ backgroundColor: bg, minWidth: "72px" }}>
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: labelColor }}>{label}</span>
      <span className="text-xl font-black" style={{ color }}>{value}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════
   LEADERBOARD
══════════════════════════════════════════════ */
function Leaderboard({ scores, loading }: { scores: ScoreEntry[]; loading: boolean }) {
  if (loading) return (
    <div className="flex justify-center py-6">
      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "#f57c00", borderTopColor: "transparent" }} />
    </div>
  );
  if (scores.length === 0) return (
    <p className="text-center py-4 text-sm" style={{ color: "#9fa8da" }}>No scores yet — be the first!</p>
  );
  const badge = (i: number) => ["rank-gold", "rank-silver", "rank-bronze"][i] ?? "rank-default";
  return (
    <div className="flex flex-col gap-2">
      {scores.map((s, i) => (
        <div key={s.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
          style={{ backgroundColor: i < 3 ? "#fff8f0" : "#f0f3ff", border: i < 3 ? "1.5px solid rgba(245,124,0,0.2)" : "1.5px solid #e8eaf0" }}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-black text-xs flex-shrink-0 ${badge(i)}`}>{i + 1}</div>
          <div className="flex-1 min-w-0">
            <div className="font-bold truncate" style={{ color: "#1a237e", fontSize: "14px" }}>{s.nickname}</div>
            <div className="text-xs" style={{ color: "#9fa8da" }}>Round {s.round}</div>
          </div>
          <div className="font-black text-lg" style={{ color: "#f57c00" }}>{s.score}</div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════
   PEEK OVERLAY
══════════════════════════════════════════════ */
function PeekOverlay({ countdown }: { countdown: number }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-20 rounded-3xl pointer-events-none"
      style={{ background: "rgba(240,243,255,0.75)", backdropFilter: "blur(2px)" }}>
      <div className="text-center px-6 py-5 rounded-2xl bg-white shadow-xl"
        style={{ border: "2px solid #e8eaf0" }}>
        <div className="text-5xl font-black mb-1" style={{ color: "#f57c00" }}>{countdown}</div>
        <div className="text-lg font-black" style={{ color: "#1a237e" }}>Memorize!</div>
        <div className="text-sm mt-1" style={{ color: "#9fa8da" }}>Cards will flip in {countdown}s</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   JOKER LEGEND BADGE
══════════════════════════════════════════════ */
function JokerBadge() {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold"
      style={{ backgroundColor: "#f5f0ff", color: "#9c27b0", border: "1.5px solid #ce93d8" }}>
      🃏 Joker = matches any card!
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════ */
export default function MemoryGame() {
  const [phase, setPhase] = useState<GamePhase>("menu");
  const [nickname, setNickname] = useState("");
  const [nicknameInput, setNicknameInput] = useState("");
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
  const [peekCountdown, setPeekCountdown] = useState(PEEK_SECONDS);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [scoresLoading, setScoresLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const peekRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roundScoreRef = useRef(0);
  const pendingRoundRef = useRef(1);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const clearPeek = useCallback(() => {
    if (peekRef.current) { clearInterval(peekRef.current); peekRef.current = null; }
  }, []);

  const loadScores = useCallback(async () => {
    setScoresLoading(true);
    const data = await fetchScores();
    setScores(data);
    setScoresLoading(false);
  }, []);

  useEffect(() => { loadScores(); }, [loadScores]);

  /* ── Start peek phase ── */
  const startPeek = useCallback((r: number) => {
    clearTimer();
    clearPeek();
    pendingRoundRef.current = r;
    const deck = buildDeck(r, true); // all face-up
    setCards(deck);
    setFlipped([]);
    setLocked(true);
    setMoves(0);
    setMatchesFound(0);
    setShowConfetti(false);
    setPeekCountdown(PEEK_SECONDS);
    setPhase("peek");
  }, [clearTimer, clearPeek]);

  /* ── Peek countdown tick ── */
  useEffect(() => {
    if (phase !== "peek") return;
    clearPeek();
    peekRef.current = setInterval(() => {
      setPeekCountdown(c => {
        if (c <= 1) {
          clearPeek();
          // Flip all cards face-down, start game
          const r = pendingRoundRef.current;
          const time = getTimeLimit(r);
          setCards(prev => prev.map(card => ({ ...card, isFlipped: false })));
          setLocked(false);
          setTimeLeft(time);
          setTotalTime(time);
          setPhase("playing");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return clearPeek;
  }, [phase, clearPeek]);

  /* ── Main game timer ── */
  useEffect(() => {
    if (phase !== "playing") return;
    clearTimer();
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearTimer(); setPhase("timeUp"); return 0; }
        return t - 1;
      });
    }, 1000);
    return clearTimer;
  }, [phase, clearTimer]);

  const startGame = useCallback(() => {
    setRound(1);
    setScore(0);
    setSubmitted(false);
    roundScoreRef.current = 0;
    startPeek(1);
  }, [startPeek]);

  /* ── Card click handler ── */
  const handleCardClick = useCallback((id: number) => {
    if (locked || phase !== "playing") return;
    const card = cards.find(c => c.id === id);
    if (!card || card.isFlipped || card.isMatched) return;
    if (flipped.length === 1 && flipped[0] === id) return;

    const newFlipped = [...flipped, id];
    setCards(prev => prev.map(c => c.id === id ? { ...c, isFlipped: true } : c));

    if (newFlipped.length === 2) {
      setLocked(true);
      setMoves(m => m + 1);

      const cardA = cards.find(c => c.id === newFlipped[0])!;
      const cardB = { ...card };

      // Match if same pair OR either is a joker
      const isMatch =
        cardA.pairId === cardB.pairId ||
        cardA.pairId === JOKER_PAIR_ID ||
        cardB.pairId === JOKER_PAIR_ID;

      if (isMatch) {
        const bonus = Math.max(10, timeLeft) + (cardA.isJoker || cardB.isJoker ? 20 : 0);
        setScore(s => { roundScoreRef.current = s + bonus; return s + bonus; });

        setTimeout(() => {
          setCards(prev => {
            const updated = prev.map(c => {
              if (newFlipped.includes(c.id)) return { ...c, isMatched: true, isFlipped: true };
              // If a joker matched a regular card, auto-match the twin too (bonus!)
              const regularCard = cardA.isJoker ? cardB : cardB.isJoker ? cardA : null;
              if (regularCard && c.pairId === regularCard.pairId && !c.isMatched && !newFlipped.includes(c.id)) {
                return { ...c, isMatched: true, isFlipped: true };
              }
              return c;
            });
            // Check win: all cards matched
            if (updated.every(c => c.isMatched)) {
              clearTimer();
              setShowConfetti(true);
              setTimeout(() => { setPhase("roundWin"); setShowConfetti(false); }, 1800);
            }
            return updated;
          });
          setMatchesFound(mf => mf + 1);
          setFlipped([]);
          setLocked(false);
        }, 300);
      } else {
        setTimeout(() => {
          setCards(prev => prev.map(c => newFlipped.includes(c.id) ? { ...c, isFlipped: false } : c));
          setFlipped([]);
          setLocked(false);
        }, 900);
      }
      setFlipped(newFlipped);
    } else {
      setFlipped(newFlipped);
    }
  }, [cards, flipped, locked, phase, timeLeft, clearTimer]);

  /* ── Submit score on game end ── */
  useEffect(() => {
    if ((phase === "timeUp" || phase === "gameOver") && nickname && !submitted) {
      setSubmitted(true);
      postScore(nickname, roundScoreRef.current, round).then(() => loadScores());
    }
  }, [phase, nickname, submitted, round, loadScores]);

  const pairCount = getPairCount(round);
  const totalCards = pairCount * 2 + 2; // +2 jokers
  const cols = getCols(totalCards);
  const MAX_ROUNDS = ALL_CARD_TYPES.length;

  return (
    <div className="min-h-screen bg-dots flex flex-col" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      <Confetti active={showConfetti} />

      {/* ══ HEADER ══ */}
      <header className="flex items-center justify-between px-5 py-3 bg-white"
        style={{ borderBottom: "2px solid #e8eaf0", boxShadow: "0 2px 12px rgba(26,35,126,0.07)" }}>
        <div className="flex items-center gap-3">
          <img src="/rcf-logo.png" alt="RCF" className="w-10 h-10 object-contain" />
          <div>
            <div className="font-black text-lg leading-none" style={{ color: "#1a237e" }}>RCF</div>
            <div className="font-bold tracking-widest text-xs" style={{ color: "#f57c00" }}>THE BEST</div>
          </div>
        </div>
        <span className="hidden sm:block font-black text-sm tracking-widest uppercase" style={{ color: "#9fa8da" }}>Memory Challenge</span>
        {(phase === "peek" || phase === "playing") && (
          <div className="flex items-center gap-2">
            {nickname && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold" style={{ backgroundColor: "#f0f3ff", color: "#1a237e" }}>
                👤 {nickname}
              </div>
            )}
            <StatPill label="Score" value={score} accent />
            <StatPill label="Round" value={round} />
          </div>
        )}
      </header>

      {/* ══ MAIN ══ */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 gap-5">

        {/* ── MENU ── */}
        {phase === "menu" && (
          <div className="w-full max-w-4xl mx-auto grid md:grid-cols-2 gap-6 items-center">
            <div className="text-center md:text-left">
              <img src="/rcf-logo.png" alt="RCF" className="w-24 h-24 object-contain mx-auto md:mx-0 mb-4" />
              <h1 className="text-5xl font-black leading-tight mb-1" style={{ color: "#1a237e" }}>Memory<br />Challenge</h1>
              <p className="font-bold tracking-wider text-sm mb-3" style={{ color: "#f57c00" }}>EL RIDWANE CHAUD & FROID</p>
              <p className="text-sm mb-5" style={{ color: "#5c6bc0" }}>
                Match pairs of HVAC icons before time runs out.<br />
                Each round adds more cards, randomly chosen!
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold" style={{ backgroundColor: "#fff8f0", color: "#f57c00", border: "1.5px solid rgba(245,124,0,0.3)" }}>
                  👁️ Memorize before start
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold" style={{ backgroundColor: "#f5f0ff", color: "#9c27b0", border: "1.5px solid #ce93d8" }}>
                  🃏 Joker wildcards
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold" style={{ backgroundColor: "#f0f3ff", color: "#1a237e", border: "1.5px solid #c5cae9" }}>
                  🎲 Random cards each round
                </div>
              </div>
              <button onClick={() => setPhase("nickname")}
                className="px-10 py-4 rounded-2xl font-black text-white text-lg tracking-wider uppercase transition-all hover:scale-105 active:scale-95 shadow-lg"
                style={{ backgroundColor: "#f57c00", boxShadow: "0 6px 24px rgba(245,124,0,0.35)" }}>
                Play Now →
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div className="bg-white rounded-3xl p-5" style={{ border: "1.5px solid #e8eaf0", boxShadow: "0 4px 20px rgba(26,35,126,0.07)" }}>
                <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#9fa8da" }}>14 card types — randomly picked each round</div>
                <div className="grid grid-cols-7 gap-1.5 mb-3">
                  {ALL_CARD_TYPES.map(c => (
                    <div key={c.pairId} className="flex flex-col items-center justify-center rounded-xl p-1.5"
                      style={{ backgroundColor: "#f0f3ff", border: "1px solid #e8eaf0" }}>
                      <span className="text-lg leading-none">{c.emoji}</span>
                    </div>
                  ))}
                  <div className="flex flex-col items-center justify-center rounded-xl p-1.5"
                    style={{ backgroundColor: "#f5f0ff", border: "1.5px solid #ce93d8" }}>
                    <span className="text-lg leading-none">🃏</span>
                  </div>
                </div>
                <div className="flex justify-between text-xs font-semibold" style={{ color: "#9fa8da" }}>
                  <span>▶ Round 1: 10 cards · 90s</span>
                  <span>Round 7: 30 cards · 30s</span>
                </div>
              </div>
              <div className="bg-white rounded-3xl p-5" style={{ border: "1.5px solid #e8eaf0", boxShadow: "0 4px 20px rgba(26,35,126,0.07)" }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-black text-sm uppercase tracking-wider" style={{ color: "#1a237e" }}>🏆 Top Scores</h3>
                  <button onClick={loadScores} className="text-xs font-semibold rounded-lg px-2 py-1 hover:opacity-80" style={{ color: "#f57c00", backgroundColor: "#fff8f0" }}>Refresh</button>
                </div>
                <Leaderboard scores={scores.slice(0, 5)} loading={scoresLoading} />
              </div>
            </div>
          </div>
        )}

        {/* ── NICKNAME ── */}
        {phase === "nickname" && (
          <div className="celebration-enter bg-white rounded-3xl p-8 w-full max-w-md mx-auto text-center"
            style={{ border: "1.5px solid #e8eaf0", boxShadow: "0 8px 40px rgba(26,35,126,0.1)" }}>
            <img src="/rcf-logo.png" alt="RCF" className="w-16 h-16 object-contain mx-auto mb-4" />
            <h2 className="text-3xl font-black mb-1" style={{ color: "#1a237e" }}>Enter Your Name</h2>
            <p className="text-sm mb-6" style={{ color: "#9fa8da" }}>Your name will appear on the leaderboard</p>
            <input type="text"
              className="input-rcf w-full rounded-2xl px-5 py-3.5 text-lg font-bold mb-4 text-center"
              style={{ border: "2px solid #e8eaf0", color: "#1a237e", backgroundColor: "#f8faff", outline: "none" }}
              placeholder="Your nickname..."
              maxLength={30}
              value={nicknameInput}
              onChange={e => setNicknameInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && nicknameInput.trim()) { setNickname(nicknameInput.trim()); startGame(); } }}
              autoFocus />
            <button
              onClick={() => { if (nicknameInput.trim()) { setNickname(nicknameInput.trim()); startGame(); } }}
              disabled={!nicknameInput.trim()}
              className="w-full py-4 rounded-2xl font-black text-white text-lg uppercase tracking-wider transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:scale-100"
              style={{ backgroundColor: "#f57c00", boxShadow: "0 6px 20px rgba(245,124,0,0.3)" }}>
              Start Game 🚀
            </button>
            <button onClick={() => setPhase("menu")} className="mt-3 text-sm font-semibold hover:underline" style={{ color: "#9fa8da" }}>
              ← Back to menu
            </button>
          </div>
        )}

        {/* ── PEEK ── */}
        {phase === "peek" && (
          <div className="w-full max-w-3xl mx-auto flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="font-black text-lg" style={{ color: "#1a237e" }}>
                👁️ Memorize the cards!
              </div>
              <JokerBadge />
            </div>
            <div className="relative">
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                {cards.map(card => (
                  <MemoryCard key={card.id} card={card} onClick={() => {}} disabled={true} peeking={true} />
                ))}
              </div>
              <PeekOverlay countdown={peekCountdown} />
            </div>
          </div>
        )}

        {/* ── PLAYING ── */}
        {phase === "playing" && (
          <div className="w-full max-w-3xl mx-auto flex flex-col gap-3">
            <div className="bg-white rounded-2xl px-4 py-2.5 flex items-center justify-between gap-2"
              style={{ border: "1.5px solid #e8eaf0", boxShadow: "0 2px 12px rgba(26,35,126,0.06)" }}>
              <StatPill label="Pairs" value={`${matchesFound}/${pairCount + 1}`} />
              <Timer timeLeft={timeLeft} totalTime={totalTime} />
              <StatPill label="Moves" value={moves} />
              <StatPill label="🃏" value="×2" purple />
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {cards.map(card => (
                <MemoryCard key={card.id} card={card} onClick={() => handleCardClick(card.id)} disabled={locked} />
              ))}
            </div>
          </div>
        )}

        {/* ── ROUND WIN ── */}
        {phase === "roundWin" && (
          <div className="celebration-enter bg-white rounded-3xl p-8 w-full max-w-md mx-auto text-center"
            style={{ border: "1.5px solid #e8eaf0", boxShadow: "0 8px 40px rgba(26,35,126,0.1)" }}>
            <div className="text-6xl mb-3">🎉</div>
            <h2 className="text-4xl font-black mb-1" style={{ color: "#1a237e" }}>Round {round} Done!</h2>
            <p className="text-sm mb-2" style={{ color: "#5c6bc0" }}>{moves} moves · {timeLeft}s remaining</p>
            <div className="text-5xl font-black my-4" style={{ color: "#f57c00" }}>{score} pts</div>
            {round < MAX_ROUNDS && (
              <div className="rounded-2xl px-4 py-3 mb-5 text-sm font-semibold" style={{ backgroundColor: "#f0f3ff", color: "#3949ab" }}>
                Next: {getPairCount(round + 1) * 2 + 2} cards · {getTimeLimit(round + 1)}s · {PEEK_SECONDS}s preview
              </div>
            )}
            <div className="flex gap-3">
              {round < MAX_ROUNDS ? (
                <button onClick={() => { const next = round + 1; setRound(next); startPeek(next); }}
                  className="flex-1 py-4 rounded-2xl font-black text-white text-lg uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
                  style={{ backgroundColor: "#f57c00", boxShadow: "0 4px 16px rgba(245,124,0,0.35)" }}>
                  Next Round →
                </button>
              ) : (
                <button onClick={() => setPhase("gameOver")}
                  className="flex-1 py-4 rounded-2xl font-black text-white text-lg uppercase tracking-wider transition-all hover:scale-105"
                  style={{ backgroundColor: "#f57c00" }}>
                  See Results
                </button>
              )}
              <button onClick={() => { setRound(1); setScore(0); roundScoreRef.current = 0; setSubmitted(false); startPeek(1); }}
                className="px-5 py-4 rounded-2xl font-semibold transition-all hover:scale-105"
                style={{ backgroundColor: "#f0f3ff", color: "#1a237e" }}>
                Restart
              </button>
            </div>
          </div>
        )}

        {/* ── TIME UP ── */}
        {phase === "timeUp" && (
          <div className="celebration-enter w-full max-w-4xl mx-auto grid md:grid-cols-2 gap-5 items-start">
            <div className="bg-white rounded-3xl p-8 text-center" style={{ border: "1.5px solid #e8eaf0", boxShadow: "0 8px 40px rgba(26,35,126,0.1)" }}>
              <div className="text-6xl mb-3">⏰</div>
              <h2 className="text-4xl font-black mb-2" style={{ color: "#1a237e" }}>Time's Up!</h2>
              <p className="text-sm mb-4" style={{ color: "#5c6bc0" }}>
                {nickname && <><strong>{nickname}</strong> — </>}found {matchesFound}/{pairCount + 1} pairs on Round {round}
              </p>
              <div className="text-5xl font-black mb-5" style={{ color: "#f57c00" }}>{score} pts</div>
              <div className="flex gap-3">
                <button onClick={() => { setRound(1); setScore(0); roundScoreRef.current = 0; setSubmitted(false); setPhase("nickname"); }}
                  className="flex-1 py-3.5 rounded-2xl font-black text-white text-base uppercase tracking-wider hover:scale-105 active:scale-95 transition-all"
                  style={{ backgroundColor: "#f57c00", boxShadow: "0 4px 16px rgba(245,124,0,0.35)" }}>
                  Try Again
                </button>
                <button onClick={() => setPhase("menu")}
                  className="px-5 py-3.5 rounded-2xl font-semibold hover:scale-105 transition-all"
                  style={{ backgroundColor: "#f0f3ff", color: "#1a237e" }}>
                  Menu
                </button>
              </div>
            </div>
            <div className="bg-white rounded-3xl p-6" style={{ border: "1.5px solid #e8eaf0", boxShadow: "0 8px 40px rgba(26,35,126,0.1)" }}>
              <h3 className="font-black text-sm uppercase tracking-wider mb-4" style={{ color: "#1a237e" }}>🏆 Leaderboard</h3>
              <Leaderboard scores={scores} loading={scoresLoading} />
            </div>
          </div>
        )}

        {/* ── GAME OVER ── */}
        {phase === "gameOver" && (
          <div className="celebration-enter w-full max-w-4xl mx-auto grid md:grid-cols-2 gap-5 items-start">
            <div className="bg-white rounded-3xl p-8 text-center" style={{ border: "1.5px solid #e8eaf0", boxShadow: "0 8px 40px rgba(26,35,126,0.1)" }}>
              <img src="/rcf-logo.png" alt="RCF" className="w-16 h-16 object-contain mx-auto mb-3" />
              <h2 className="text-4xl font-black mb-1" style={{ color: "#1a237e" }}>Champion!</h2>
              <p className="font-bold tracking-widest text-sm mb-3" style={{ color: "#f57c00" }}>RCF THE BEST</p>
              {nickname && <p className="text-sm mb-2" style={{ color: "#5c6bc0" }}>Well done, <strong>{nickname}</strong>!</p>}
              <p className="text-sm mb-4" style={{ color: "#9fa8da" }}>All {MAX_ROUNDS} rounds completed!</p>
              <div className="text-5xl font-black mb-4" style={{ color: "#f57c00" }}>{score} pts</div>
              <div className="flex justify-center gap-1 mb-5">
                {[0.1, 0.25, 0.4].map((delay, i) => (
                  <span key={i} className="star-pop text-4xl" style={{ animationDelay: `${delay}s` }}>⭐</span>
                ))}
              </div>
              <button onClick={() => { setRound(1); setScore(0); roundScoreRef.current = 0; setSubmitted(false); setPhase("nickname"); }}
                className="w-full py-4 rounded-2xl font-black text-white text-lg uppercase tracking-wider hover:scale-105 active:scale-95 transition-all"
                style={{ backgroundColor: "#f57c00", boxShadow: "0 6px 24px rgba(245,124,0,0.35)" }}>
                Play Again
              </button>
            </div>
            <div className="bg-white rounded-3xl p-6" style={{ border: "1.5px solid #e8eaf0", boxShadow: "0 8px 40px rgba(26,35,126,0.1)" }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-sm uppercase tracking-wider" style={{ color: "#1a237e" }}>🏆 Leaderboard</h3>
                <button onClick={loadScores} className="text-xs font-semibold rounded-lg px-2 py-1 hover:opacity-80" style={{ color: "#f57c00", backgroundColor: "#fff8f0" }}>Refresh</button>
              </div>
              <Leaderboard scores={scores} loading={scoresLoading} />
            </div>
          </div>
        )}
      </main>

      {/* ══ FOOTER ══ */}
      <footer className="bg-white text-center py-3 text-xs font-semibold"
        style={{ color: "#c5cae9", borderTop: "1.5px solid #e8eaf0" }}>
        El Ridwane Chaud & Froid — RCF THE BEST ·{" "}
        <span style={{ color: "#f57c00" }}>© 2026</span>
      </footer>
    </div>
  );
}
