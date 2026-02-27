"use client";

import { useState, useEffect, useRef, useCallback, ChangeEvent } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type MapId = "ascent" | "bind" | "haven" | "split" | "lotus" | "sunset" | "icebox" | "abyss" | "fracture" | "pearl" | "breeze" | "corrode";
type Format = "bo1" | "bo3" | "bo5";
type MapState = "available" | "banned" | "picked" | "decider";
type Side = "attack" | "defense";
type Action = "BAN" | "PICK";
type CoinSide = "heads" | "tails";
type Stage = "setup" | "cointoss" | "veto" | "summary";

interface ValorantMap {
  id: MapId;
  name: string;
  color: string;
}

interface VetoStep {
  action: Action;
  teamIndex: number;
}

interface MatchConfig {
  teamA: string;
  teamB: string;
  logoA: string | null;
  logoB: string | null;
  format: Format;
  enabledMaps: MapId[];
  timerEnabled: boolean;
  timerSeconds: number;
}

interface MapMeta {
  picker: string;
  side: Side;
}

interface HistoryEntry {
  text: string;
  type: "ban" | "pick" | "decider";
  teamIndex?: number;
}

interface VetoResult {
  mapStates: Record<MapId, MapState>;
  mapMeta: Partial<Record<MapId, MapMeta>>;
  history: HistoryEntry[];
  activeMaps: ValorantMap[];
}

interface SideModalState {
  mapId: MapId;
  mapName: string;
  teamIndex: number;
}

// ─── Data ────────────────────────────────────────────────────────────────────
const ALL_MAPS: ValorantMap[] = [
  { id: "ascent",   name: "Ascent",   color: "#E8C97A" },
  { id: "bind",     name: "Bind",     color: "#C97A4A" },
  { id: "haven",    name: "Haven",    color: "#7AC97A" },
  { id: "split",    name: "Split",    color: "#9A7AC9" },
  { id: "lotus",    name: "Lotus",    color: "#C97A9A" },
  { id: "sunset",   name: "Sunset",   color: "#E8A05A" },
  { id: "icebox",   name: "Icebox",   color: "#7ABFE8" },
  { id: "abyss",    name: "Abyss",    color: "#4A5A9A" },
  { id: "fracture", name: "Fracture", color: "#9AC97A" },
  { id: "pearl",    name: "Pearl",    color: "#7AC9C9" },
  { id: "breeze",   name: "Breeze",   color: "#7AC9E8" },
  { id: "corrode",   name: "Corrode",   color: "#7A9A7A" },
];

// ─── Map images — place files in /public/maps/ ────────────────────────────────
// Name them exactly: ascent.jpg, bind.jpg, haven.jpg, etc.
const MAP_IMAGES: Record<MapId, string> = {
  ascent:   "/maps/ascent.jpg",
  bind:     "/maps/bind.jpg",
  haven:    "/maps/haven.jpg",
  split:    "/maps/split.jpg",
  lotus:    "/maps/lotus.jpg",
  sunset:   "/maps/sunset.jpg",
  icebox:   "/maps/icebox.jpg",
  abyss:    "/maps/abyss.jpg",
  fracture: "/maps/fracture.jpg",
  pearl:    "/maps/pearl.jpg",
  breeze:  "/maps/breeze.jpg",
  corrode:  "/maps/corrode.jpg",
};

const VETO_SEQUENCES: Record<Format, VetoStep[]> = {
  bo1: [
    { action: "BAN", teamIndex: 0 },
    { action: "BAN", teamIndex: 1 },
    { action: "BAN", teamIndex: 0 },
    { action: "BAN", teamIndex: 1 },
    { action: "BAN", teamIndex: 0 },
    { action: "BAN", teamIndex: 1 },
  ],
  bo3: [
    { action: "BAN",  teamIndex: 0 },
    { action: "BAN",  teamIndex: 1 },
    { action: "PICK", teamIndex: 0 },
    { action: "PICK", teamIndex: 1 },
    { action: "BAN",  teamIndex: 0 },
    { action: "BAN",  teamIndex: 1 },
  ],
  bo5: [
    { action: "BAN",  teamIndex: 0 },
    { action: "BAN",  teamIndex: 1 },
    { action: "PICK", teamIndex: 0 },
    { action: "PICK", teamIndex: 1 },
    { action: "PICK", teamIndex: 0 },
    { action: "PICK", teamIndex: 1 },
  ],
};

const mapGradients: Record<MapId, string> = {
  ascent:   "from-amber-900 via-amber-800 to-stone-900",
  bind:     "from-orange-900 via-red-900 to-stone-900",
  haven:    "from-green-900 via-emerald-800 to-stone-900",
  split:    "from-purple-900 via-violet-900 to-stone-900",
  lotus:    "from-pink-900 via-rose-900 to-stone-900",
  sunset:   "from-orange-800 via-amber-900 to-stone-900",
  icebox:   "from-blue-900 via-cyan-900 to-stone-900",
  abyss:    "from-blue-950 via-indigo-900 to-stone-900",
  fracture: "from-lime-900 via-green-900 to-stone-900",
  pearl:    "from-teal-900 via-cyan-900 to-stone-900",
  breeze:  "from-sky-900 via-cyan-900 to-stone-900",
  corrode:  "from-green-950 via-green-800 to-stone-900",
};

const mapAccents: Record<MapId, string> = {
  ascent:   "#E8C97A",
  bind:     "#E88A4A",
  haven:    "#6AE87A",
  split:    "#A87AE8",
  lotus:    "#E87AAA",
  sunset:   "#E8AA5A",
  icebox:   "#7ACCE8",
  abyss:    "#6A7ACE",
  fracture: "#AAE87A",
  pearl:    "#7AE8CE",
  breeze:  "#7ACCE8",
  corrode:  "#7A9A7A",
};

const FONTS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Rajdhani:wght@400;500;600;700&display=swap');
`;

// ─── Logo ─────────────────────────────────────────────────────────────────────
function Logo({ name, logo, side = "left" }: { name: string; logo: string | null; side?: "left" | "right" }) {
  return (
    <div className={`flex items-center gap-3 ${side === "right" ? "flex-row-reverse" : ""}`}>
      {logo ? (
        <img src={logo} alt={name} className="w-12 h-12 object-contain rounded" />
      ) : (
        <div
          className="w-12 h-12 rounded flex items-center justify-center text-lg font-black border border-white/20"
          style={{ background: "rgba(255,255,255,0.08)", fontFamily: "Barlow Condensed, sans-serif" }}
        >
          {name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <span className="text-xl font-bold tracking-widest uppercase" style={{ fontFamily: "Barlow Condensed, sans-serif" }}>
        {name}
      </span>
    </div>
  );
}

// ─── MapCard ──────────────────────────────────────────────────────────────────
function MapCard({
  map,
  state,
  onClick,
  sideAttacker,
  disabled,
}: {
  map: ValorantMap;
  state: MapState;
  onClick?: () => void;
  sideAttacker?: string | null;
  disabled?: boolean;
}) {
  const accent = mapAccents[map.id];
  const gradient = mapGradients[map.id];
  const isAvailable = state === "available";
  const [imgError, setImgError] = useState(false);

  const stateStyles: Record<MapState, string> = {
    available: "cursor-pointer hover:scale-105 hover:shadow-lg",
    banned:    "cursor-not-allowed",
    picked:    "cursor-not-allowed",
    decider:   "cursor-not-allowed",
  };

  const borderStyle: React.CSSProperties =
    state === "decider"
      ? { border: `2px solid ${accent}`, boxShadow: `0 0 20px ${accent}88, 0 0 40px ${accent}44` }
      : state === "picked"
      ? { border: `2px solid ${accent}`, boxShadow: `0 0 12px ${accent}66` }
      : state === "banned"
      ? { border: "1px solid rgba(255,70,85,0.3)" }
      : { border: "1px solid rgba(255,255,255,0.12)" };

  return (
    <div
      className={`relative rounded-xl overflow-hidden select-none transition-all duration-300 ${stateStyles[state]} ${disabled && isAvailable ? "opacity-50" : ""}`}
      style={borderStyle}
      onClick={isAvailable && !disabled ? onClick : undefined}
    >
      {/* Map image with gradient fallback */}
      {!imgError ? (
        <img
          src={MAP_IMAGES[map.id]}
          alt={map.name}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
          onError={() => setImgError(true)}
        />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
      )}

      {/* Dark scrim */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

      {/* Hover shimmer */}
      {isAvailable && !disabled && (
        <div
          className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-200"
          style={{ background: `radial-gradient(ellipse at 50% 100%, ${accent}33 0%, transparent 70%)` }}
        />
      )}

      {/* Card content */}
      <div className="relative h-36 flex flex-col justify-between p-3">
        {/* Top-right badge */}
        <div className="flex justify-end">
          {state === "banned" && (
            <div className="bg-red-600/90 backdrop-blur-sm rounded-md px-2 py-0.5 flex items-center gap-1">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
          {state === "picked" && (
            <div className="backdrop-blur-sm rounded-md px-2 py-0.5 flex items-center gap-1" style={{ background: accent + "cc" }}>
              <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
          )}
          {state === "decider" && (
            <div className="backdrop-blur-sm rounded-md px-2 py-0.5 animate-pulse" style={{ background: accent + "bb" }}>
              <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            </div>
          )}
        </div>

        {/* Bottom: name + status */}
        <div>
          <div
            className="font-black tracking-widest uppercase text-base leading-tight"
            style={{ fontFamily: "Barlow Condensed, sans-serif", color: "white", textShadow: "0 1px 8px rgba(0,0,0,0.9)" }}
          >
            {map.name}
          </div>
          {state === "banned" && (
            <div className="text-red-400 text-xs font-bold tracking-widest uppercase mt-0.5" style={{ fontFamily: "Rajdhani" }}>
              BANNED
            </div>
          )}
          {state === "picked" && (
            <div className="text-xs font-bold tracking-wider mt-0.5" style={{ color: accent, fontFamily: "Rajdhani" }}>
              {sideAttacker ? `${sideAttacker} ATK` : "PICKED"}
            </div>
          )}
          {state === "decider" && (
            <div className="text-xs font-black tracking-widest uppercase mt-0.5 animate-pulse" style={{ color: accent, fontFamily: "Barlow Condensed" }}>
              DECIDER
            </div>
          )}
        </div>
      </div>

      {/* Ban overlay */}
      {state === "banned" && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <svg className="w-14 h-14 text-red-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ─── CoinToss ─────────────────────────────────────────────────────────────────
function CoinToss({ teamA, teamB, onComplete }: { teamA: string; teamB: string; onComplete: (firstTeam: number) => void }) {
  const [phase, setPhase] = useState<"choose" | "flipping" | "result" | "decide">("choose");
  const [choice, setChoice] = useState<CoinSide | null>(null);
  const [result, setResult] = useState<CoinSide | null>(null);
  const [winner, setWinner] = useState<number | null>(null);
  const [isFlipping, setIsFlipping] = useState(false);
  const [firstTeam, setFirstTeam] = useState<number | null>(null);
  const teams = [teamA, teamB];

  const flip = (chosenSide: CoinSide) => {
    setChoice(chosenSide);
    setPhase("flipping");
    setIsFlipping(true);
    const actual: CoinSide = Math.random() < 0.5 ? "heads" : "tails";
    setTimeout(() => {
      setResult(actual);
      setIsFlipping(false);
      const won = chosenSide === actual;
      setWinner(won ? 0 : 1);
      setPhase("result");
    }, 2000);
  };

  const chooseOrder = (goFirst: boolean) => {
    if (winner === null) return;
    const firstTeamIndex = goFirst ? winner : winner === 0 ? 1 : 0;
    setFirstTeam(firstTeamIndex);
    setPhase("decide");
    setTimeout(() => onComplete(firstTeamIndex), 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ fontFamily: "Rajdhani, sans-serif" }}>
      <div className="max-w-2xl w-full">
        <div className="text-center mb-12">
          <div className="text-xs tracking-[0.4em] text-[#FF4655] font-bold mb-2 uppercase">Valorant Map Veto</div>
          <h1 className="text-5xl font-black tracking-widest uppercase text-white" style={{ fontFamily: "Barlow Condensed, sans-serif" }}>
            Coin Toss
          </h1>
        </div>

        <div className="flex items-center justify-between mb-10">
          <div className="text-center">
            <div className="w-16 h-16 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl font-black mx-auto mb-3" style={{ fontFamily: "Barlow Condensed" }}>
              {teamA.slice(0, 2).toUpperCase()}
            </div>
            <div className="text-lg font-bold tracking-wider text-white/80 uppercase">{teamA}</div>
          </div>

          <div className="flex-1 flex justify-center">
            <div
              className={`w-28 h-28 rounded-full border-4 border-yellow-400 flex items-center justify-center transition-all duration-200 ${isFlipping ? "animate-spin" : ""}`}
              style={{
                background: isFlipping
                  ? "conic-gradient(from 0deg, #FFD700, #B8860B, #FFD700)"
                  : result
                  ? "radial-gradient(circle, #FFD700 0%, #B8860B 100%)"
                  : "radial-gradient(circle, #888 0%, #444 100%)",
                boxShadow: result ? "0 0 30px #FFD70066" : "none",
              }}
            >
              <span className="text-3xl font-black" style={{ fontFamily: "Barlow Condensed" }}>
                {isFlipping ? "?" : result === "heads" ? "H" : result === "tails" ? "T" : "?"}
              </span>
            </div>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl font-black mx-auto mb-3" style={{ fontFamily: "Barlow Condensed" }}>
              {teamB.slice(0, 2).toUpperCase()}
            </div>
            <div className="text-lg font-bold tracking-wider text-white/80 uppercase">{teamB}</div>
          </div>
        </div>

        {phase === "choose" && (
          <div className="text-center">
            <div className="text-white/60 mb-6 text-sm tracking-widest uppercase">{teamA} — Choose your side</div>
            <div className="flex gap-4 justify-center">
              {(["heads", "tails"] as CoinSide[]).map((side) => (
                <button
                  key={side}
                  onClick={() => flip(side)}
                  className="px-10 py-4 rounded-xl border-2 border-white/30 text-white font-black text-xl tracking-widest uppercase hover:bg-white/10 hover:border-white/60 transition-all"
                  style={{ fontFamily: "Barlow Condensed" }}
                >
                  {side.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === "flipping" && (
          <div className="text-center">
            <div className="text-yellow-400 font-bold tracking-widest uppercase animate-pulse text-xl">Flipping...</div>
          </div>
        )}

        {phase === "result" && winner !== null && result && (
          <div className="text-center">
            <div className="text-3xl font-black tracking-widest uppercase mb-2" style={{ fontFamily: "Barlow Condensed", color: "#FF4655" }}>
              {result.toUpperCase()} WINS!
            </div>
            <div className="text-white/70 mb-8 tracking-wider">
              <span className="text-white font-bold">{teams[winner]}</span> won the coin toss
            </div>
            <div className="text-white/60 text-sm tracking-widest uppercase mb-4">{teams[winner]} — Choose your order</div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => chooseOrder(true)}
                className="px-8 py-4 rounded-xl font-black text-lg tracking-widest uppercase transition-all"
                style={{ fontFamily: "Barlow Condensed", background: "#FF4655", color: "white" }}
              >
                Start First
              </button>
              <button
                onClick={() => chooseOrder(false)}
                className="px-8 py-4 rounded-xl border-2 border-white/30 text-white font-black text-lg tracking-widest uppercase hover:bg-white/10 transition-all"
                style={{ fontFamily: "Barlow Condensed" }}
              >
                Start Second
              </button>
            </div>
          </div>
        )}

        {phase === "decide" && firstTeam !== null && (
          <div className="text-center">
            <div className="text-white font-bold tracking-widest text-xl animate-pulse" style={{ fontFamily: "Barlow Condensed" }}>
              {teams[firstTeam]} will go FIRST
            </div>
            <div className="text-white/40 text-sm mt-2 tracking-wider">Starting veto...</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SideSelectModal ──────────────────────────────────────────────────────────
function SideSelectModal({ mapName, teamName, onSelect }: { mapName: string; teamName: string; onSelect: (side: Side) => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="rounded-2xl p-8 max-w-sm w-full text-center border border-white/10" style={{ background: "rgba(15,15,25,0.95)", fontFamily: "Rajdhani, sans-serif" }}>
        <div className="text-xs tracking-[0.4em] text-[#FF4655] font-bold mb-2 uppercase">Map Selected</div>
        <h2 className="text-4xl font-black tracking-widest uppercase text-white mb-1" style={{ fontFamily: "Barlow Condensed" }}>
          {mapName}
        </h2>
        <p className="text-white/50 text-sm tracking-wider mb-8">{teamName} — Choose starting side</p>
        <div className="flex gap-4">
          <button
            onClick={() => onSelect("attack")}
            className="flex-1 py-4 rounded-xl font-black text-lg tracking-widest uppercase transition-all hover:scale-105"
            style={{ fontFamily: "Barlow Condensed", background: "#FF4655", color: "white" }}
          >
            ⚔ Attack
          </button>
          <button
            onClick={() => onSelect("defense")}
            className="flex-1 py-4 rounded-xl font-black text-lg tracking-widest uppercase border-2 border-white/30 text-white hover:bg-white/10 transition-all hover:scale-105"
            style={{ fontFamily: "Barlow Condensed" }}
          >
            🛡 Defense
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Timer ────────────────────────────────────────────────────────────────────
function Timer({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setRemaining(seconds); }, [seconds]);

  useEffect(() => {
    ref.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (ref.current) clearInterval(ref.current);
          onExpire();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [seconds, onExpire]);

  const pct = remaining / seconds;
  const color = pct > 0.5 ? "#4AE84A" : pct > 0.25 ? "#E8E84A" : "#FF4655";

  return (
    <div className="flex items-center gap-3">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center font-black text-xl border-4 transition-colors"
        style={{ borderColor: color, color, fontFamily: "Barlow Condensed" }}
      >
        {remaining}
      </div>
    </div>
  );
}

// ─── SetupScreen ──────────────────────────────────────────────────────────────
function SetupScreen({ onStart }: { onStart: (config: MatchConfig) => void }) {
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [logoA, setLogoA] = useState<string | null>(null);
  const [logoB, setLogoB] = useState<string | null>(null);
  const [format, setFormat] = useState<Format>("bo3");
  const [enabledMaps, setEnabledMaps] = useState<MapId[]>(ALL_MAPS.map((m) => m.id));
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(30);

  const handleLogo = (team: "A" | "B", e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    team === "A" ? setLogoA(url) : setLogoB(url);
  };

  const toggleMap = (id: MapId) => {
    setEnabledMaps((prev) => prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]);
  };

  const canStart = enabledMaps.length >= 7;

  const handleStart = () => {
    onStart({ teamA: teamA || "Team A", teamB: teamB || "Team B", logoA, logoB, format, enabledMaps, timerEnabled, timerSeconds });
  };

  return (
    <div className="min-h-screen p-8 max-w-4xl mx-auto" style={{ fontFamily: "Rajdhani, sans-serif" }}>
      <div className="text-center mb-12">
        <div className="text-xs tracking-[0.4em] text-[#FF4655] font-bold mb-2 uppercase">Valorant</div>
        <h1 className="text-6xl font-black tracking-widest uppercase text-white" style={{ fontFamily: "Barlow Condensed, sans-serif" }}>
          Map Veto
        </h1>
        <p className="text-white/40 text-sm tracking-widest mt-2 uppercase">Tournament Configuration</p>
      </div>

      {/* Teams */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {(["A", "B"] as const).map((team) => (
          <div key={team} className="rounded-2xl p-6 border border-white/10 bg-white/5">
            <div className={`text-xs font-bold tracking-[0.3em] uppercase mb-4 ${team === "A" ? "text-[#FF4655]" : "text-blue-400"}`}>
              Team {team}
            </div>
            <input
              value={team === "A" ? teamA : teamB}
              onChange={(e) => team === "A" ? setTeamA(e.target.value) : setTeamB(e.target.value)}
              placeholder={`Team ${team}`}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white font-bold tracking-wider text-lg mb-4 outline-none focus:border-[#FF4655] transition-colors placeholder-white/30"
              style={{ fontFamily: "Barlow Condensed" }}
            />
            <label className="block text-xs text-white/40 tracking-widest uppercase mb-2">Logo (optional)</label>
            <label className="flex items-center gap-3 cursor-pointer bg-white/5 border border-white/10 rounded-xl px-4 py-3 hover:bg-white/10 transition">
              {(team === "A" ? logoA : logoB) ? (
                <img src={(team === "A" ? logoA : logoB)!} className="w-8 h-8 object-contain rounded" alt="logo" />
              ) : (
                <svg className="w-6 h-6 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
              <span className="text-white/50 text-sm">{(team === "A" ? logoA : logoB) ? "Logo uploaded" : "Upload logo"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogo(team, e)} />
            </label>
          </div>
        ))}
      </div>

      {/* Format */}
      <div className="rounded-2xl p-6 border border-white/10 bg-white/5 mb-6">
        <div className="text-white/60 text-xs font-bold tracking-[0.3em] uppercase mb-4">Match Format</div>
        <div className="flex gap-4">
          {(["bo1", "bo3", "bo5"] as Format[]).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`flex-1 py-4 rounded-xl font-black text-xl tracking-widest uppercase transition-all ${format === f ? "text-white scale-105" : "text-white/40 border border-white/20 hover:text-white/70"}`}
              style={{
                fontFamily: "Barlow Condensed",
                background: format === f ? "#FF4655" : "transparent",
                boxShadow: format === f ? "0 0 20px #FF465544" : "none",
              }}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Map Pool */}
      <div className="rounded-2xl p-6 border border-white/10 bg-white/5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-white/60 text-xs font-bold tracking-[0.3em] uppercase">Map Pool</div>
          <div className={`text-xs font-bold tracking-wider ${enabledMaps.length >= 7 ? "text-green-400" : "text-red-400"}`}>
            {enabledMaps.length} / {ALL_MAPS.length} selected (min 7)
          </div>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {ALL_MAPS.map((map) => {
            const enabled = enabledMaps.includes(map.id);
            const accent = mapAccents[map.id];
            return (
              <div
                key={map.id}
                onClick={() => toggleMap(map.id)}
                className="relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:scale-105"
                style={{
                  height: "88px",
                  border: enabled ? `2px solid ${accent}` : "1px solid rgba(255,255,255,0.12)",
                  boxShadow: enabled ? `0 0 12px ${accent}55` : "none",
                  opacity: enabled ? 1 : 0.4,
                }}
              >
                <img
                  src={MAP_IMAGES[map.id]}
                  alt={map.name}
                  className="absolute inset-0 w-full h-full object-cover"
                  draggable={false}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <div className={`absolute inset-0 bg-gradient-to-br ${mapGradients[map.id]}`} style={{ zIndex: -1 }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5">
                  <div
                    className="text-xs font-black tracking-wider uppercase"
                    style={{ fontFamily: "Barlow Condensed", color: enabled ? accent : "rgba(255,255,255,0.5)", textShadow: "0 1px 6px rgba(0,0,0,1)" }}
                  >
                    {map.name}
                  </div>
                </div>
                {enabled ? (
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: accent }}>
                    <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-white/25 text-xs tracking-wider mt-3">Click a map to enable / disable it</p>
      </div>

      {/* Options */}
      <div className="rounded-2xl p-6 border border-white/10 bg-white/5 mb-8">
        <div className="text-white/60 text-xs font-bold tracking-[0.3em] uppercase mb-4">Options</div>
        <div className="flex items-center gap-6 flex-wrap">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setTimerEnabled((v) => !v)}
              className={`w-12 h-6 rounded-full transition-colors relative ${timerEnabled ? "bg-[#FF4655]" : "bg-white/20"}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${timerEnabled ? "left-7" : "left-1"}`} />
            </div>
            <span className="text-white/70 text-sm font-bold tracking-wider uppercase">Timer</span>
          </label>
          {timerEnabled && (
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-xs tracking-wider">Seconds:</span>
              <select
                value={timerSeconds}
                onChange={(e) => setTimerSeconds(Number(e.target.value))}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-white text-sm font-bold outline-none"
              >
                {[15, 20, 30, 45, 60].map((s) => <option key={s} value={s}>{s}s</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {!canStart && (
        <p className="text-center text-red-400 text-sm tracking-wider mb-4 font-bold">Please select at least 7 maps to continue</p>
      )}
      <button
        onClick={handleStart}
        disabled={!canStart}
        className={`w-full py-5 rounded-2xl font-black text-2xl tracking-widest uppercase transition-all ${canStart ? "hover:scale-105 hover:shadow-2xl" : "opacity-40 cursor-not-allowed"}`}
        style={{ fontFamily: "Barlow Condensed", background: canStart ? "#FF4655" : "#666", boxShadow: canStart ? "0 0 30px #FF465566" : "none" }}
      >
        Start Veto →
      </button>
    </div>
  );
}

// ─── VetoScreen ───────────────────────────────────────────────────────────────
function VetoScreen({ config, firstTeam, onFinish }: { config: MatchConfig; firstTeam: number; onFinish: (result: VetoResult) => void }) {
  const { teamA, teamB, logoA, logoB, format, enabledMaps, timerEnabled, timerSeconds } = config;
  const teams = [teamA, teamB];
  const logos = [logoA, logoB];

  const sequence: VetoStep[] = VETO_SEQUENCES[format].map((step) => ({
    ...step,
    teamIndex: step.teamIndex === 0 ? firstTeam : firstTeam === 0 ? 1 : 0,
  }));

  const activeMaps = ALL_MAPS.filter((m) => enabledMaps.includes(m.id));

  const [mapStates, setMapStates] = useState<Record<string, MapState>>(() => {
    const s: Record<string, MapState> = {};
    activeMaps.forEach((m) => { s[m.id] = "available"; });
    return s;
  });
  const [mapMeta, setMapMeta] = useState<Partial<Record<string, MapMeta>>>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sideModal, setSideModal] = useState<SideModalState | null>(null);
  const [timerKey, setTimerKey] = useState(0);

  const currentStep = sequence[stepIndex] as VetoStep | undefined;

  const finalize = useCallback((
    states: Record<string, MapState>,
    meta: Partial<Record<string, MapMeta>>,
    hist: HistoryEntry[]
  ) => {
    const remaining = activeMaps.filter((m) => states[m.id] === "available");
    if (remaining.length === 1) {
      const deciderMap = remaining[0];
      const finalStates = { ...states, [deciderMap.id]: "decider" as MapState };
      setMapStates(finalStates);
      const finalHist = [...hist, { text: `${deciderMap.name} is the DECIDER`, type: "decider" as const }];
      setHistory(finalHist);
      setTimeout(() => {
        onFinish({ mapStates: finalStates as Record<MapId, MapState>, mapMeta: meta as Partial<Record<MapId, MapMeta>>, history: finalHist, activeMaps });
      }, 1500);
    } else {
      onFinish({ mapStates: states as Record<MapId, MapState>, mapMeta: meta as Partial<Record<MapId, MapMeta>>, history: hist, activeMaps });
    }
  }, [activeMaps, onFinish]);

  const handleMapClick = useCallback((map: ValorantMap) => {
    if (!currentStep || sideModal) return;
    const step = currentStep;

    if (step.action === "BAN") {
      const newStates = { ...mapStates, [map.id]: "banned" as MapState };
      const newHistory: HistoryEntry[] = [...history, { text: `${teams[step.teamIndex]} banned ${map.name}`, type: "ban", teamIndex: step.teamIndex }];
      setMapStates(newStates);
      setHistory(newHistory);
      const nextStep = stepIndex + 1;
      setStepIndex(nextStep);
      setTimerKey((k) => k + 1);
      if (nextStep >= sequence.length) finalize(newStates, mapMeta, newHistory);
    } else {
      setSideModal({ mapId: map.id as MapId, mapName: map.name, teamIndex: step.teamIndex });
    }
  }, [currentStep, mapStates, history, teams, stepIndex, sequence.length, sideModal, mapMeta, finalize]);

  const handleSideSelect = useCallback((side: Side) => {
    if (!sideModal) return;
    const { mapId, mapName, teamIndex } = sideModal;
    const newMeta = { ...mapMeta, [mapId]: { picker: teams[teamIndex], side } };
    const newStates = { ...mapStates, [mapId]: "picked" as MapState };
    const newHistory: HistoryEntry[] = [...history, {
      text: `${teams[teamIndex]} picked ${mapName} (${side === "attack" ? "Attack" : "Defense"})`,
      type: "pick",
      teamIndex,
    }];
    setMapMeta(newMeta);
    setMapStates(newStates);
    setHistory(newHistory);
    setSideModal(null);
    const nextStep = stepIndex + 1;
    setStepIndex(nextStep);
    setTimerKey((k) => k + 1);
    if (nextStep >= sequence.length) finalize(newStates, newMeta, newHistory);
  }, [sideModal, mapMeta, mapStates, history, teams, stepIndex, sequence.length, finalize]);

  const handleTimerExpire = useCallback(() => {
    if (!currentStep || sideModal) return;
    const available = activeMaps.filter((m) => mapStates[m.id] === "available");
    if (available.length === 0) return;
    handleMapClick(available[Math.floor(Math.random() * available.length)]);
  }, [currentStep, sideModal, activeMaps, mapStates, handleMapClick]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && sideModal) setSideModal(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [sideModal]);

  const actionColor = currentStep?.action === "BAN" ? "#FF4655" : "#4AE8AA";
  const teamColors = ["#FF4655", "#4A9AFF"];

  return (
    <div className="min-h-screen p-4 flex flex-col" style={{ fontFamily: "Rajdhani, sans-serif" }}>
      {/* Header */}
      <div className="rounded-2xl p-4 mb-4 border border-white/10 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.04)" }}>
        <Logo name={teamA} logo={logoA} side="left" />
        <div className="text-center">
          <div className="text-white/30 text-xs tracking-[0.4em] uppercase mb-1">{format.toUpperCase()}</div>
          <div className="text-2xl font-black tracking-widest text-white" style={{ fontFamily: "Barlow Condensed" }}>VS</div>
        </div>
        <Logo name={teamB} logo={logoB} side="right" />
      </div>

      {/* Turn indicator */}
      {currentStep && (
        <div className="rounded-2xl p-4 mb-4 text-center border" style={{ borderColor: actionColor + "44", background: actionColor + "11" }}>
          <div className="flex items-center justify-center gap-4">
            {timerEnabled && <Timer key={timerKey} seconds={timerSeconds} onExpire={handleTimerExpire} />}
            <div>
              <div className="text-xs tracking-[0.4em] uppercase mb-1" style={{ color: teamColors[currentStep.teamIndex] }}>
                {teams[currentStep.teamIndex]}
              </div>
              <div className="text-4xl font-black tracking-widest" style={{ fontFamily: "Barlow Condensed", color: actionColor }}>
                {currentStep.action}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4 flex-1">
        {/* Map grid */}
        <div className="flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {activeMaps.map((map) => (
              <MapCard
                key={map.id}
                map={map}
                state={mapStates[map.id]}
                onClick={() => handleMapClick(map)}
                sideAttacker={
                  mapStates[map.id] === "picked" && mapMeta[map.id]?.side === "attack"
                    ? mapMeta[map.id]!.picker
                    : null
                }
                disabled={!currentStep}
              />
            ))}
          </div>
        </div>

        {/* History panel */}
        <div className="w-64 rounded-2xl p-4 border border-white/10 flex flex-col" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div className="text-xs font-bold tracking-[0.3em] text-white/40 uppercase mb-3">Veto History</div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {history.length === 0 && <div className="text-white/20 text-xs tracking-wider text-center mt-4">No actions yet</div>}
            {history.map((h, i) => (
              <div
                key={i}
                className="text-xs rounded-lg px-3 py-2 border font-bold"
                style={{
                  background: h.type === "ban" ? "rgba(255,70,85,0.1)" : h.type === "pick" ? "rgba(74,232,170,0.1)" : "rgba(255,215,0,0.1)",
                  borderColor: h.type === "ban" ? "rgba(255,70,85,0.3)" : h.type === "pick" ? "rgba(74,232,170,0.3)" : "rgba(255,215,0,0.3)",
                  color: h.type === "ban" ? "#FF4655" : h.type === "pick" ? "#4AE8AA" : "#FFD700",
                  fontFamily: "Rajdhani",
                  letterSpacing: "0.05em",
                }}
              >
                {h.text}
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="text-xs text-white/30 tracking-wider text-center">Step {stepIndex} / {sequence.length}</div>
          </div>
        </div>
      </div>

      {sideModal && (
        <SideSelectModal mapName={sideModal.mapName} teamName={teams[sideModal.teamIndex]} onSelect={handleSideSelect} />
      )}
    </div>
  );
}

// ─── SummaryScreen ────────────────────────────────────────────────────────────
function SummaryScreen({ config, result, onReset }: { config: MatchConfig; result: VetoResult; onReset: () => void }) {
  const { teamA, teamB, format } = config;
  const { mapStates, mapMeta, activeMaps } = result;

  const picks = activeMaps.filter((m) => mapStates[m.id as MapId] === "picked");
  const decider = activeMaps.find((m) => mapStates[m.id as MapId] === "decider");

  const copyResult = () => {
    const lines = [
      `${format.toUpperCase()} — ${teamA} vs ${teamB}`,
      "",
      ...picks.map((m, i) => {
        const meta = mapMeta[m.id];
        return `Map ${i + 1}: ${m.name}${meta ? ` — ${meta.picker} (${meta.side === "attack" ? "ATK" : "DEF"})` : ""}`;
      }),
      decider ? `Decider: ${decider.name}` : "",
    ].filter(Boolean);
    navigator.clipboard.writeText(lines.join("\n"));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ fontFamily: "Rajdhani, sans-serif" }}>
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="text-xs tracking-[0.4em] text-[#FF4655] font-bold mb-2 uppercase">Match Summary</div>
          <h1 className="text-5xl font-black tracking-widest uppercase text-white mb-2" style={{ fontFamily: "Barlow Condensed" }}>
            {format.toUpperCase()} Ready
          </h1>
          <div className="flex items-center justify-center gap-4 text-white/50">
            <span className="font-bold tracking-wider">{teamA}</span>
            <span>vs</span>
            <span className="font-bold tracking-wider">{teamB}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 overflow-hidden mb-6" style={{ background: "rgba(255,255,255,0.04)" }}>
          {picks.map((m, i) => {
            const meta = mapMeta[m.id];
            const accent = mapAccents[m.id as MapId];
            return (
              <div key={m.id} className="flex items-center gap-4 px-6 py-4 border-b border-white/5" style={{ borderLeft: `4px solid ${accent}` }}>
                <div className="text-white/40 text-sm font-bold w-6 text-center" style={{ fontFamily: "Barlow Condensed" }}>{i + 1}</div>
                <div className="flex-1">
                  <div className="font-black text-xl tracking-wider uppercase" style={{ fontFamily: "Barlow Condensed", color: accent }}>{m.name}</div>
                  {meta && <div className="text-white/50 text-sm tracking-wider">{meta.picker} starts {meta.side === "attack" ? "⚔ Attack" : "🛡 Defense"}</div>}
                </div>
                <div className="text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-lg" style={{ background: accent + "22", color: accent }}>PICK</div>
              </div>
            );
          })}
          {decider && (
            <div className="flex items-center gap-4 px-6 py-4" style={{ borderLeft: `4px solid ${mapAccents[decider.id as MapId]}`, background: mapAccents[decider.id as MapId] + "11" }}>
              <div className="text-white/40 text-sm font-bold w-6 text-center">★</div>
              <div className="flex-1">
                <div className="font-black text-xl tracking-wider uppercase" style={{ fontFamily: "Barlow Condensed", color: mapAccents[decider.id as MapId] }}>{decider.name}</div>
              </div>
              <div className="text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-lg animate-pulse" style={{ background: mapAccents[decider.id as MapId] + "33", color: mapAccents[decider.id as MapId] }}>DECIDER</div>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <button onClick={copyResult} className="flex-1 py-4 rounded-xl border border-white/20 text-white font-black text-lg tracking-widest uppercase hover:bg-white/10 transition-all" style={{ fontFamily: "Barlow Condensed" }}>
            Copy Result
          </button>
          <button onClick={onReset} className="flex-1 py-4 rounded-xl font-black text-lg tracking-widest uppercase transition-all hover:scale-105" style={{ fontFamily: "Barlow Condensed", background: "#FF4655", boxShadow: "0 0 20px #FF465544" }}>
            Reset Veto
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [stage, setStage] = useState<Stage>("setup");
  const [config, setConfig] = useState<MatchConfig | null>(null);
  const [firstTeam, setFirstTeam] = useState(0);
  const [result, setResult] = useState<VetoResult | null>(null);

  const handleReset = () => { setStage("setup"); setConfig(null); setResult(null); setFirstTeam(0); };

  return (
    <>
      <style>{FONTS}</style>
      <div
        className="min-h-screen text-white"
        style={{ background: "radial-gradient(ellipse at top left, #1a0a0e 0%, #0a0a14 40%, #08080f 100%)", backgroundAttachment: "fixed" }}
      >
        <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-50" style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 2px)" }} />
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 flex gap-2">
          {(["setup", "cointoss", "veto", "summary"] as Stage[]).map((s, i) => (
            <div key={s} className="w-2 h-2 rounded-full transition-all" style={{ background: s === stage ? "#FF4655" : i < (["setup", "cointoss", "veto", "summary"] as Stage[]).indexOf(stage) ? "rgba(255,70,85,0.4)" : "rgba(255,255,255,0.2)" }} />
          ))}
        </div>

        {stage === "setup" && <SetupScreen onStart={(cfg) => { setConfig(cfg); setStage("cointoss"); }} />}
        {stage === "cointoss" && config && <CoinToss teamA={config.teamA} teamB={config.teamB} onComplete={(first) => { setFirstTeam(first); setStage("veto"); }} />}
        {stage === "veto" && config && <VetoScreen config={config} firstTeam={firstTeam} onFinish={(res) => { setResult(res); setStage("summary"); }} />}
        {stage === "summary" && config && result && <SummaryScreen config={config} result={result} onReset={handleReset} />}
      </div>
    </>
  );
}
