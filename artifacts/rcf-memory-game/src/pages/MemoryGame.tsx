import { useState, useEffect, useCallback, useRef } from "react";

interface CardData {
  id: number;
  pairId: number;
  emoji: string;
  label: string;
  isFlipped: boolean;
  isMatched: boolean;
}

interface ScoreEntry {
  id: number;
  nickname: string;
  score: number;
  round: number;
  createdAt: string;
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
  return shuffle(doubled).map((c, i) => ({
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

type GamePhase = "menu" | "nickname" | "playing" | "roundWin" | "timeUp" | "gameOver";

/* ── Confetti ── */
function Confetti({ active }: { active: boolean }) {
  const [pieces, setPieces] = useState<{ id: number; x: number; color: string; dur: number; delay: number; size: number }[]>([]);
  useEffect(() => {
    if (!active) { setPieces([]); return; }
    const colors = ["#f57c00", "#ff9800", "#1a237e", "#ffd740", "#ff5722", "#4caf50", "#e91e63"];
    setPieces(Array.from({ length: 50 }, (_, i) => ({
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

/* ── Card components ── */
function CardBack() {
  return (
    <div className="card-face card-back w-full h-full flex flex-col items-center justify-center rounded-2xl hero-gradient"
      style={{ border: "2px solid rgba(245,124,0,0.4)" }}>
      <img src="/rcf-logo.png" alt="RCF" className="w-10 h-10 object-contain opacity-90" />
      <div className="mt-1 font-black tracking-widest" style={{ color: "#f57c00", fontSize: "8px" }}>RCF THE BEST</div>
    </div>
  );
}

function CardFront({ emoji, label, matched }: { emoji: string; label: string; matched: boolean }) {
  return (
    <div className={`card-face card-front w-full h-full flex flex-col items-center justify-center rounded-2xl relative ${matched ? "card-matched-anim" : ""}`}
      style={{ backgroundColor: matched ? "#fff8f0" : "#fff", border: matched ? "2.5px solid #f57c00" : "2px solid #e8eaf0", boxShadow: matched ? "0 4px 20px rgba(245,124,0,0.18)" : "0 2px 8px rgba(26,35,126,0.07)" }}>
      <span className="text-3xl sm:text-4xl leading-none">{emoji}</span>
      <span className="mt-2 font-bold px-1 text-center leading-tight" style={{ color: "#1a237e", fontSize: "9px" }}>{label}</span>
      {matched && <span className="absolute top-1.5 right-2 text-xs font-black" style={{ color: "#f57c00" }}>✓</span>}
    </div>
  );
}

function Card({ card, onClick, disabled }: { card: CardData; onClick: () => void; disabled: boolean }) {
  const canClick = !card.isFlipped && !card.isMatched && !disabled;
  return (
    <div className={`card-scene card-hover ${card.isMatched ? "matched-card" : ""}`}
      style={{ width: "100%", aspectRatio: "1 / 1.25", cursor: canClick ? "pointer" : "default" }}
      onClick={canClick ? onClick : undefined}>
      <div className={`card-inner ${card.isFlipped || card.isMatched ? "flipped" : ""}`}>
        <CardBack />
        <CardFront emoji={card.emoji} label={card.label} matched={card.isMatched} />
      </div>
    </div>
  );
}

/* ── Timer ── */
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

/* ── Stat pill ── */
function StatPill({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center px-4 py-2 rounded-2xl" style={{ backgroundColor: accent ? "#fff8f0" : "#f0f3ff", minWidth: "80px" }}>
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: accent ? "#f57c00" : "#5c6bc0" }}>{label}</span>
      <span className="text-2xl font-black" style={{ color: accent ? "#f57c00" : "#1a237e" }}>{value}</span>
    </div>
  );
}

/* ── Leaderboard ── */
function Leaderboard({ scores, loading }: { scores: ScoreEntry[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#f57c00", borderTopColor: "transparent" }} />
      </div>
    );
  }
  if (scores.length === 0) {
    return <p className="text-center py-4 text-sm" style={{ color: "#9fa8da" }}>No scores yet — be the first!</p>;
  }
  const rankBadge = (i: number) => {
    if (i === 0) return "rank-gold";
    if (i === 1) return "rank-silver";
    if (i === 2) return "rank-bronze";
    return "rank-default";
  };
  return (
    <div className="flex flex-col gap-2">
      {scores.map((s, i) => (
        <div key={s.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ backgroundColor: i < 3 ? "#fff8f0" : "#f0f3ff", border: i < 3 ? "1.5px solid rgba(245,124,0,0.2)" : "1.5px solid #e8eaf0" }}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-black text-xs flex-shrink-0 ${rankBadge(i)}`}>
            {i + 1}
          </div>
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

/* ── API helpers ── */
async function fetchScores(): Promise<ScoreEntry[]> {
  const res = await fetch("/api/scores?limit=10");
  if (!res.ok) return [];
  return res.json();
}

async function postScore(nickname: string, score: number, round: number): Promise<void> {
  await fetch("/api/scores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname, score, round }),
  });
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
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [scoresLoading, setScoresLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roundScoreRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const loadScores = useCallback(async () => {
    setScoresLoading(true);
    const data = await fetchScores();
    setScores(data);
    setScoresLoading(false);
  }, []);

  useEffect(() => { loadScores(); }, [loadScores]);

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
    setShowConfetti(false);
    setPhase("playing");
  }, [clearTimer]);

  const startGame = useCallback(() => {
    setRound(1);
    setScore(0);
    setSubmitted(false);
    roundScoreRef.current = 0;
    startRound(1);
  }, [startRound]);

  /* Timer tick */
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
      const [a, b] = newFlipped.map(fid => cards.find(c => c.id === fid)!);

      if (a.pairId === b.pairId) {
        const bonus = Math.max(10, timeLeft);
        setScore(s => { roundScoreRef.current = s + bonus; return s + bonus; });
        setMatchesFound(mf => {
          const newMF = mf + 1;
          const totalPairs = Math.min(4 + (round - 1) * 2, ALL_CARD_TYPES.length);
          setTimeout(() => {
            setCards(prev => prev.map(c => newFlipped.includes(c.id) ? { ...c, isMatched: true, isFlipped: true } : c));
            setFlipped([]);
            setLocked(false);
            if (newMF === totalPairs) {
              clearTimer();
              setShowConfetti(true);
              setTimeout(() => { setPhase("roundWin"); setShowConfetti(false); }, 1800);
            }
          }, 300);
          return newMF;
        });
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
  }, [cards, flipped, locked, phase, timeLeft, round, clearTimer]);

  /* Submit score when game ends */
  useEffect(() => {
    if ((phase === "timeUp" || phase === "gameOver") && nickname && !submitted) {
      setSubmitted(true);
      postScore(nickname, roundScoreRef.current, round).then(() => loadScores());
    }
  }, [phase, nickname, submitted, round, loadScores]);

  const pairCount = Math.min(4 + (round - 1) * 2, ALL_CARD_TYPES.length);

  return (
    <div className="min-h-screen bg-dots flex flex-col" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      <Confetti active={showConfetti} />

      {/* ── Header ── */}
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
        {phase !== "menu" && phase !== "nickname" && (
          <div className="flex items-center gap-3">
            {nickname && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold" style={{ backgroundColor: "#f0f3ff", color: "#1a237e" }}>
                👤 {nickname}
              </div>
            )}
            <div className="flex items-center gap-2">
              <StatPill label="Score" value={score} accent />
              <StatPill label="Round" value={round} />
            </div>
          </div>
        )}
      </header>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 gap-6">

        {/* MENU */}
        {phase === "menu" && (
          <div className="w-full max-w-4xl mx-auto grid md:grid-cols-2 gap-6 items-center">
            {/* Left: Intro */}
            <div className="text-center md:text-left">
              <img src="/rcf-logo.png" alt="RCF" className="w-24 h-24 object-contain mx-auto md:mx-0 mb-4" />
              <h1 className="text-5xl font-black leading-tight mb-1" style={{ color: "#1a237e" }}>Memory<br />Challenge</h1>
              <p className="font-bold tracking-wider text-sm mb-3" style={{ color: "#f57c00" }}>EL RIDWANE CHAUD & FROID</p>
              <p className="text-sm mb-6" style={{ color: "#5c6bc0" }}>
                Match pairs of HVAC icons before time runs out.<br />Each round adds more pairs and less time!
              </p>
              <button onClick={() => setPhase("nickname")}
                className="px-10 py-4 rounded-2xl font-black text-white text-lg tracking-wider uppercase transition-all hover:scale-105 active:scale-95 shadow-lg"
                style={{ backgroundColor: "#f57c00", boxShadow: "0 6px 24px rgba(245,124,0,0.35)" }}>
                Play Now →
              </button>
            </div>
            {/* Right: Cards preview + leaderboard */}
            <div className="flex flex-col gap-4">
              <div className="bg-white rounded-3xl p-5" style={{ border: "1.5px solid #e8eaf0", boxShadow: "0 4px 20px rgba(26,35,126,0.07)" }}>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {ALL_CARD_TYPES.map(c => (
                    <div key={c.pairId} className="flex flex-col items-center justify-center rounded-xl p-2"
                      style={{ backgroundColor: "#f0f3ff", border: "1.5px solid #e8eaf0" }}>
                      <span className="text-2xl">{c.emoji}</span>
                      <span className="text-center font-semibold mt-1 leading-tight" style={{ color: "#1a237e", fontSize: "8px" }}>{c.label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 text-xs font-semibold" style={{ color: "#9fa8da" }}>
                  <span>▶ Round 1: 4 pairs · 90s</span>
                  <span>· · ·</span>
                  <span>Round 5: 8 pairs · 50s</span>
                </div>
              </div>
              {/* Mini leaderboard */}
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

        {/* NICKNAME ENTRY */}
        {phase === "nickname" && (
          <div className="celebration-enter bg-white rounded-3xl p-8 w-full max-w-md mx-auto text-center"
            style={{ border: "1.5px solid #e8eaf0", boxShadow: "0 8px 40px rgba(26,35,126,0.1)" }}>
            <img src="/rcf-logo.png" alt="RCF" className="w-16 h-16 object-contain mx-auto mb-4" />
            <h2 className="text-3xl font-black mb-1" style={{ color: "#1a237e" }}>Enter Your Name</h2>
            <p className="text-sm mb-6" style={{ color: "#9fa8da" }}>Your name will appear on the leaderboard</p>
            <input
              type="text"
              className="input-rcf w-full rounded-2xl px-5 py-3.5 text-lg font-bold mb-4 text-center"
              style={{ border: "2px solid #e8eaf0", color: "#1a237e", backgroundColor: "#f8faff", outline: "none" }}
              placeholder="Your nickname..."
              maxLength={30}
              value={nicknameInput}
              onChange={e => setNicknameInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && nicknameInput.trim()) {
                  setNickname(nicknameInput.trim());
                  startGame();
                }
              }}
              autoFocus
            />
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

        {/* PLAYING */}
        {phase === "playing" && (
          <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
            {/* Stats bar */}
            <div className="bg-white rounded-2xl px-5 py-3 flex items-center justify-between"
              style={{ border: "1.5px solid #e8eaf0", boxShadow: "0 2px 12px rgba(26,35,126,0.06)" }}>
              <StatPill label="Pairs" value={`${matchesFound}/${pairCount}`} />
              <Timer timeLeft={timeLeft} totalTime={totalTime} />
              <StatPill label="Moves" value={moves} />
            </div>
            {/* Card grid */}
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(4, 1fr)` }}>
              {cards.map(card => (
                <Card key={card.id} card={card} onClick={() => handleCardClick(card.id)} disabled={locked} />
              ))}
            </div>
          </div>
        )}

        {/* ROUND WIN */}
        {phase === "roundWin" && (
          <div className="celebration-enter bg-white rounded-3xl p-8 w-full max-w-md mx-auto text-center"
            style={{ border: "1.5px solid #e8eaf0", boxShadow: "0 8px 40px rgba(26,35,126,0.1)" }}>
            <div className="text-6xl mb-3">🎉</div>
            <h2 className="text-4xl font-black mb-1" style={{ color: "#1a237e" }}>Round {round} Done!</h2>
            <p className="text-sm mb-2" style={{ color: "#5c6bc0" }}>
              {moves} moves · {timeLeft}s remaining
            </p>
            <div className="text-5xl font-black my-4" style={{ color: "#f57c00" }}>{score} pts</div>
            {round < ALL_CARD_TYPES.length && (
              <div className="rounded-2xl px-4 py-3 mb-5 text-sm font-semibold" style={{ backgroundColor: "#f0f3ff", color: "#3949ab" }}>
                Next: {Math.min(4 + round * 2, ALL_CARD_TYPES.length * 2)} cards · {getTimeLimit(round + 1)}s
              </div>
            )}
            <div className="flex gap-3">
              {round < ALL_CARD_TYPES.length ? (
                <button onClick={() => { const next = round + 1; setRound(next); startRound(next); }}
                  className="flex-1 py-4 rounded-2xl font-black text-white text-lg uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
                  style={{ backgroundColor: "#f57c00", boxShadow: "0 4px 16px rgba(245,124,0,0.35)" }}>
                  Next Round →
                </button>
              ) : (
                <button onClick={() => setPhase("gameOver")}
                  className="flex-1 py-4 rounded-2xl font-black text-white text-lg uppercase tracking-wider transition-all hover:scale-105"
                  style={{ backgroundColor: "#f57c00", boxShadow: "0 4px 16px rgba(245,124,0,0.35)" }}>
                  See Results
                </button>
              )}
              <button onClick={() => setPhase("nickname")}
                className="px-5 py-4 rounded-2xl font-semibold transition-all hover:scale-105"
                style={{ backgroundColor: "#f0f3ff", color: "#1a237e" }}>
                Restart
              </button>
            </div>
          </div>
        )}

        {/* TIME UP */}
        {phase === "timeUp" && (
          <div className="celebration-enter w-full max-w-4xl mx-auto grid md:grid-cols-2 gap-5 items-start">
            <div className="bg-white rounded-3xl p-8 text-center" style={{ border: "1.5px solid #e8eaf0", boxShadow: "0 8px 40px rgba(26,35,126,0.1)" }}>
              <div className="text-6xl mb-3">⏰</div>
              <h2 className="text-4xl font-black mb-2" style={{ color: "#1a237e" }}>Time's Up!</h2>
              <p className="text-sm mb-4" style={{ color: "#5c6bc0" }}>
                {nickname && <><strong>{nickname}</strong> — </>}found {matchesFound}/{pairCount} pairs on Round {round}
              </p>
              <div className="text-5xl font-black mb-5" style={{ color: "#f57c00" }}>{score} pts</div>
              <div className="flex gap-3">
                <button onClick={() => setPhase("nickname")}
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

        {/* GAME OVER */}
        {phase === "gameOver" && (
          <div className="celebration-enter w-full max-w-4xl mx-auto grid md:grid-cols-2 gap-5 items-start">
            <div className="bg-white rounded-3xl p-8 text-center" style={{ border: "1.5px solid #e8eaf0", boxShadow: "0 8px 40px rgba(26,35,126,0.1)" }}>
              <img src="/rcf-logo.png" alt="RCF" className="w-16 h-16 object-contain mx-auto mb-3" />
              <h2 className="text-4xl font-black mb-1" style={{ color: "#1a237e" }}>Champion!</h2>
              <p className="font-bold tracking-widest text-sm mb-3" style={{ color: "#f57c00" }}>RCF THE BEST</p>
              {nickname && <p className="text-sm mb-2" style={{ color: "#5c6bc0" }}>Well done, <strong>{nickname}</strong>!</p>}
              <p className="text-sm mb-4" style={{ color: "#9fa8da" }}>All {ALL_CARD_TYPES.length} rounds completed!</p>
              <div className="text-5xl font-black mb-4" style={{ color: "#f57c00" }}>{score} pts</div>
              <div className="flex justify-center gap-1 mb-5">
                {[0.1, 0.25, 0.4].map((delay, i) => (
                  <span key={i} className="star-pop text-4xl" style={{ animationDelay: `${delay}s` }}>⭐</span>
                ))}
              </div>
              <button onClick={() => setPhase("nickname")}
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

      {/* ── Footer ── */}
      <footer className="bg-white text-center py-3 text-xs font-semibold"
        style={{ color: "#c5cae9", borderTop: "1.5px solid #e8eaf0" }}>
        El Ridwane Chaud & Froid — RCF THE BEST ·{" "}
        <span style={{ color: "#f57c00" }}>© 2026</span>
      </footer>
    </div>
  );
}
