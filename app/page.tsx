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

interface ValorantMap { id: MapId; name: string; color: string; }
interface VetoStep { action: Action; teamIndex: number; }
interface MatchConfig {
  teamA: string; teamB: string;
  logoA: string | null; logoB: string | null;
  format: Format; enabledMaps: MapId[];
  timerEnabled: boolean; timerSeconds: number;
}
interface MapMeta { picker: string; side: Side; }
interface HistoryEntry { text: string; type: "ban" | "pick" | "decider"; teamIndex?: number; }
interface VetoResult {
  mapStates: Record<MapId, MapState>;
  mapMeta: Partial<Record<MapId, MapMeta>>;
  history: HistoryEntry[];
  activeMaps: ValorantMap[];
  deciderTeamIndex: number;
}
interface SideModalState { mapId: MapId; mapName: string; teamIndex: number; isDecider?: boolean; }

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
  { id: "corrode",  name: "Corrode",  color: "#7A9A7A" },
];

const ACTIVE_MAP_IDS: MapId[] = ["bind", "haven", "split", "fracture", "lotus", "breeze", "corrode"];

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
  breeze:   "/maps/breeze.jpg",
  corrode:  "/maps/corrode.jpg",
};

// Veto sequences — after all steps, remaining map(s) become decider
function buildSequence(format: Format): VetoStep[] {
  switch (format) {
    case "bo1": return [
      { action: "BAN", teamIndex: 0 }, { action: "BAN", teamIndex: 1 },
      { action: "BAN", teamIndex: 0 }, { action: "BAN", teamIndex: 1 },
      { action: "BAN", teamIndex: 0 }, { action: "BAN", teamIndex: 1 },
    ];
    case "bo3": return [
      { action: "BAN",  teamIndex: 0 }, { action: "BAN",  teamIndex: 1 },
      { action: "PICK", teamIndex: 0 }, { action: "PICK", teamIndex: 1 },
      { action: "BAN",  teamIndex: 0 }, { action: "BAN",  teamIndex: 1 },
    ];
    case "bo5": return [
      { action: "BAN",  teamIndex: 0 }, { action: "BAN",  teamIndex: 1 },
      { action: "PICK", teamIndex: 0 }, { action: "PICK", teamIndex: 1 },
      { action: "PICK", teamIndex: 0 }, { action: "PICK", teamIndex: 1 },
    ];
  }
}

const mapGradients: Record<MapId, string> = {
  ascent: "from-amber-900 via-amber-800 to-stone-900",
  bind: "from-orange-900 via-red-900 to-stone-900",
  haven: "from-green-900 via-emerald-800 to-stone-900",
  split: "from-purple-900 via-violet-900 to-stone-900",
  lotus: "from-pink-900 via-rose-900 to-stone-900",
  sunset: "from-orange-800 via-amber-900 to-stone-900",
  icebox: "from-blue-900 via-cyan-900 to-stone-900",
  abyss: "from-blue-950 via-indigo-900 to-stone-900",
  fracture: "from-lime-900 via-green-900 to-stone-900",
  pearl: "from-teal-900 via-cyan-900 to-stone-900",
  breeze: "from-sky-900 via-cyan-900 to-stone-900",
  corrode: "from-green-950 via-green-800 to-stone-900",
};

const mapAccents: Record<MapId, string> = {
  ascent: "#E8C97A", bind: "#E88A4A", haven: "#6AE87A", split: "#A87AE8",
  lotus: "#E87AAA", sunset: "#E8AA5A", icebox: "#7ACCE8", abyss: "#6A7ACE",
  fracture: "#AAE87A", pearl: "#7AE8CE", breeze: "#7ACCE8", corrode: "#7A9A7A",
};

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Rajdhani:wght@400;500;600;700&display=swap');`;

// ─── Credits Card ─────────────────────────────────────────────────────────────
function CreditsCard() {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed top-4 right-4 z-50">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 backdrop-blur-md text-white/60 hover:text-white hover:border-white/30 transition-all text-xs font-bold tracking-widest uppercase"
        style={{ background: "rgba(20,10,30,0.85)", fontFamily: "Barlow Condensed" }}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>
        Credits
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute top-12 right-0 w-72 sm:w-80 rounded-2xl border border-[#5865F2]/40 p-5 shadow-2xl z-50"
            style={{ background: "linear-gradient(135deg, #1a1040 0%, #0e0c1e 100%)", fontFamily: "Rajdhani, sans-serif", boxShadow: "0 0 40px rgba(88,101,242,0.2)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#5865F2" }}>
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                  </svg>
                </div>
                <span className="text-white font-black tracking-widest uppercase text-sm" style={{ fontFamily: "Barlow Condensed" }}>Credits</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <p className="text-white/40 text-xs tracking-wider mb-4 leading-relaxed">This tool wouldn&apos;t exist without these resources.</p>

            <div className="space-y-2.5">
              {[
                {
                  icon: <svg className="w-3.5 h-3.5 text-[#5865F2]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
                  label: "Images",
                  content: <><div className="text-white/50 text-xs">Map images sourced from</div><a href="https://playvalorant.com/en-us/maps/" target="_blank" rel="noreferrer" className="text-[#5865F2] text-xs hover:text-[#7289DA] transition-colors">playvalorant.com/en-us/maps</a></>
                },
                {
                  icon: <svg className="w-3.5 h-3.5 text-[#5865F2]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
                  label: "Built With",
                  content: <div className="text-white/50 text-xs">Next.js · React · TypeScript · Tailwind CSS</div>
                },
                {
                  icon: <svg className="w-3.5 h-3.5 text-[#5865F2]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>,
                  label: "Developer",
                  content: <><div className="text-white font-bold text-sm">fielzxc</div><div className="text-white/40 text-xs">Design and development</div></>
                },
                {
                  icon: <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.022.015.043.033.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>,
                  label: "Bug Reports & Contact",
                  content: <><div className="text-white/50 text-xs mb-1">Found a bug or have suggestions? DM me on Discord:</div><div className="text-[#5865F2] font-bold text-sm">fielzxc</div></>,
                  highlight: true,
                },
              ].map(({ icon, label, content, highlight }) => (
                <div key={label} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: highlight ? "rgba(88,101,242,0.15)" : "rgba(88,101,242,0.08)", border: `1px solid rgba(88,101,242,${highlight ? "0.35" : "0.2"})` }}>
                  <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: highlight ? "#5865F2" : "rgba(88,101,242,0.3)" }}>{icon}</div>
                  <div>
                    <div className="text-white text-xs font-bold tracking-widest uppercase mb-0.5" style={{ fontFamily: "Barlow Condensed" }}>{label}</div>
                    {content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Logo ─────────────────────────────────────────────────────────────────────
function Logo({ name, logo, side = "left" }: { name: string; logo: string | null; side?: "left" | "right" }) {
  return (
    <div className={`flex items-center gap-2 sm:gap-3 ${side === "right" ? "flex-row-reverse" : ""}`}>
      {logo ? (
        <img src={logo} alt={name} className="w-8 h-8 sm:w-12 sm:h-12 object-contain rounded" />
      ) : (
        <div className="w-8 h-8 sm:w-12 sm:h-12 rounded flex items-center justify-center text-sm sm:text-lg font-black border border-white/20" style={{ background: "rgba(255,255,255,0.08)", fontFamily: "Barlow Condensed, sans-serif" }}>
          {name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <span className="text-sm sm:text-xl font-bold tracking-widest uppercase" style={{ fontFamily: "Barlow Condensed, sans-serif" }}>{name}</span>
    </div>
  );
}

// ─── MapCard ──────────────────────────────────────────────────────────────────
function MapCard({ map, state, onClick, sideAttacker, disabled }: {
  map: ValorantMap; state: MapState; onClick?: () => void;
  sideAttacker?: string | null; disabled?: boolean;
}) {
  const accent = mapAccents[map.id];
  const gradient = mapGradients[map.id];
  const isAvailable = state === "available";
  const [imgError, setImgError] = useState(false);

  const borderStyle: React.CSSProperties =
    state === "decider" ? { border: `2px solid ${accent}`, boxShadow: `0 0 20px ${accent}88, 0 0 40px ${accent}44` }
    : state === "picked" ? { border: `2px solid ${accent}`, boxShadow: `0 0 12px ${accent}66` }
    : state === "banned"  ? { border: "1px solid rgba(255,70,85,0.3)" }
    : { border: "1px solid rgba(255,255,255,0.12)" };

  return (
    <div
      className={`relative rounded-xl overflow-hidden select-none transition-all duration-300
        ${isAvailable && !disabled ? "cursor-pointer hover:scale-105 hover:shadow-lg" : "cursor-not-allowed"}
        ${disabled && isAvailable ? "opacity-50" : ""}`}
      style={borderStyle}
      onClick={isAvailable && !disabled ? onClick : undefined}
    >
      {!imgError ? (
        <img src={MAP_IMAGES[map.id]} alt={map.name} className="absolute inset-0 w-full h-full object-cover" draggable={false} onError={() => setImgError(true)} />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
      {isAvailable && !disabled && (
        <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-200" style={{ background: `radial-gradient(ellipse at 50% 100%, ${accent}33 0%, transparent 70%)` }} />
      )}
      <div className="relative h-24 sm:h-36 flex flex-col justify-between p-2 sm:p-3">
        <div className="flex justify-end">
          {state === "banned" && (
            <div className="bg-red-600/90 backdrop-blur-sm rounded-md px-1.5 py-0.5 flex items-center gap-1">
              <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
            </div>
          )}
          {state === "picked" && (
            <div className="backdrop-blur-sm rounded-md px-1.5 py-0.5 flex items-center gap-1" style={{ background: accent + "cc" }}>
              <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
            </div>
          )}
          {state === "decider" && (
            <div className="backdrop-blur-sm rounded-md px-1.5 py-0.5 animate-pulse" style={{ background: accent + "bb" }}>
              <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" /></svg>
            </div>
          )}
        </div>
        <div>
          <div className="font-black tracking-widest uppercase text-xs sm:text-base leading-tight" style={{ fontFamily: "Barlow Condensed, sans-serif", color: "white", textShadow: "0 1px 8px rgba(0,0,0,0.9)" }}>{map.name}</div>
          {state === "banned"  && <div className="text-red-400 text-xs font-bold tracking-widest uppercase mt-0.5 hidden sm:block" style={{ fontFamily: "Rajdhani" }}>BANNED</div>}
          {state === "picked"  && <div className="text-xs font-bold tracking-wider mt-0.5 hidden sm:block" style={{ color: accent, fontFamily: "Rajdhani" }}>{sideAttacker ? `${sideAttacker} ATK` : "PICKED"}</div>}
          {state === "decider" && <div className="text-xs font-black tracking-widest uppercase mt-0.5 animate-pulse hidden sm:block" style={{ color: accent, fontFamily: "Barlow Condensed" }}>DECIDER</div>}
        </div>
      </div>
      {state === "banned" && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <svg className="w-8 h-8 sm:w-14 sm:h-14 text-red-500/70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
        </div>
      )}
    </div>
  );
}

// ─── CoinToss ─────────────────────────────────────────────────────────────────
function CoinToss({ teamA, teamB, onComplete }: { teamA: string; teamB: string; onComplete: (firstTeam: number) => void }) {
  const [phase, setPhase] = useState<"choose" | "flipping" | "result" | "decide">("choose");
  const [result, setResult] = useState<CoinSide | null>(null);
  const [winner, setWinner] = useState<number | null>(null);
  const [isFlipping, setIsFlipping] = useState(false);
  const [firstTeam, setFirstTeam] = useState<number | null>(null);
  const teams = [teamA, teamB];

  const flip = (chosenSide: CoinSide) => {
    setPhase("flipping");
    setIsFlipping(true);
    const actual: CoinSide = Math.random() < 0.5 ? "heads" : "tails";
    setTimeout(() => {
      setResult(actual);
      setIsFlipping(false);
      setWinner(chosenSide === actual ? 0 : 1);
      setPhase("result");
    }, 2000);
  };

  const chooseOrder = (goFirst: boolean) => {
    if (winner === null) return;
    const idx = goFirst ? winner : winner === 0 ? 1 : 0;
    setFirstTeam(idx);
    setPhase("decide");
    setTimeout(() => onComplete(idx), 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8" style={{ fontFamily: "Rajdhani, sans-serif" }}>
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8 sm:mb-12">
          <div className="text-xs tracking-[0.4em] text-[#FF4655] font-bold mb-2 uppercase">Valorant Map Veto</div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-widest uppercase text-white" style={{ fontFamily: "Barlow Condensed, sans-serif" }}>Coin Toss</h1>
        </div>
        <div className="flex items-center justify-between mb-8 sm:mb-10">
          <div className="text-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-xl sm:text-2xl font-black mx-auto mb-2" style={{ fontFamily: "Barlow Condensed" }}>{teamA.slice(0, 2).toUpperCase()}</div>
            <div className="text-sm sm:text-lg font-bold tracking-wider text-white/80 uppercase">{teamA}</div>
          </div>
          <div className="flex-1 flex justify-center">
            <div
              className={`w-20 h-20 sm:w-28 sm:h-28 rounded-full border-4 border-yellow-400 flex items-center justify-center ${isFlipping ? "animate-spin" : ""}`}
              style={{ background: isFlipping ? "conic-gradient(from 0deg, #FFD700, #B8860B, #FFD700)" : result ? "radial-gradient(circle, #FFD700 0%, #B8860B 100%)" : "radial-gradient(circle, #888 0%, #444 100%)", boxShadow: result ? "0 0 30px #FFD70066" : "none" }}
            >
              <span className="text-2xl sm:text-3xl font-black" style={{ fontFamily: "Barlow Condensed" }}>
                {isFlipping ? "?" : result === "heads" ? "H" : result === "tails" ? "T" : "?"}
              </span>
            </div>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-xl sm:text-2xl font-black mx-auto mb-2" style={{ fontFamily: "Barlow Condensed" }}>{teamB.slice(0, 2).toUpperCase()}</div>
            <div className="text-sm sm:text-lg font-bold tracking-wider text-white/80 uppercase">{teamB}</div>
          </div>
        </div>

        {phase === "choose" && (
          <div className="text-center">
            <div className="text-white/60 mb-6 text-xs tracking-widest uppercase">{teamA} — Choose your side</div>
            <div className="flex gap-4 justify-center">
              {(["heads", "tails"] as CoinSide[]).map(side => (
                <button key={side} onClick={() => flip(side)} className="px-6 sm:px-10 py-3 sm:py-4 rounded-xl border-2 border-white/30 text-white font-black text-lg sm:text-xl tracking-widest uppercase hover:bg-white/10 transition-all" style={{ fontFamily: "Barlow Condensed" }}>{side.toUpperCase()}</button>
              ))}
            </div>
          </div>
        )}
        {phase === "flipping" && <div className="text-center"><div className="text-yellow-400 font-bold tracking-widest uppercase animate-pulse text-xl">Flipping...</div></div>}
        {phase === "result" && winner !== null && result && (
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-black tracking-widest uppercase mb-2" style={{ fontFamily: "Barlow Condensed", color: "#FF4655" }}>{result.toUpperCase()} WINS!</div>
            <div className="text-white/70 mb-6 tracking-wider text-sm"><span className="text-white font-bold">{teams[winner]}</span> won the coin toss</div>
            <div className="text-white/60 text-xs tracking-widest uppercase mb-4">{teams[winner]} — Choose your order</div>
            <div className="flex gap-3 justify-center">
              <button onClick={() => chooseOrder(true)} className="px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-black text-base sm:text-lg tracking-widest uppercase transition-all" style={{ fontFamily: "Barlow Condensed", background: "#FF4655", color: "white" }}>Start First</button>
              <button onClick={() => chooseOrder(false)} className="px-6 sm:px-8 py-3 sm:py-4 rounded-xl border-2 border-white/30 text-white font-black text-base sm:text-lg tracking-widest uppercase hover:bg-white/10 transition-all" style={{ fontFamily: "Barlow Condensed" }}>Start Second</button>
            </div>
          </div>
        )}
        {phase === "decide" && firstTeam !== null && (
          <div className="text-center">
            <div className="text-white font-bold tracking-widest text-xl animate-pulse" style={{ fontFamily: "Barlow Condensed" }}>{teams[firstTeam]} will go FIRST</div>
            <div className="text-white/40 text-sm mt-2 tracking-wider">Starting veto...</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SideSelectModal ──────────────────────────────────────────────────────────
function SideSelectModal({ mapName, teamName, onSelect, isDecider }: {
  mapName: string; teamName: string; onSelect: (side: Side) => void; isDecider?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="rounded-2xl p-6 sm:p-8 max-w-sm w-full text-center border border-white/10" style={{ background: "rgba(15,15,25,0.95)", fontFamily: "Rajdhani, sans-serif" }}>
        <div className="text-xs tracking-[0.4em] font-bold mb-2 uppercase" style={{ color: isDecider ? "#FFD700" : "#FF4655" }}>
          {isDecider ? "⭐ Decider Map" : "Map Selected"}
        </div>
        <h2 className="text-3xl sm:text-4xl font-black tracking-widest uppercase text-white mb-1" style={{ fontFamily: "Barlow Condensed" }}>{mapName}</h2>
        <p className="text-white/50 text-xs sm:text-sm tracking-wider mb-6 sm:mb-8">
          {isDecider ? `${teamName} won the toss — choose starting side` : `${teamName} — Choose starting side`}
        </p>
        <div className="flex gap-3 sm:gap-4">
          <button onClick={() => onSelect("attack")} className="flex-1 py-3 sm:py-4 rounded-xl font-black text-base sm:text-lg tracking-widest uppercase transition-all hover:scale-105" style={{ fontFamily: "Barlow Condensed", background: "#FF4655", color: "white" }}>⚔ Attack</button>
          <button onClick={() => onSelect("defense")} className="flex-1 py-3 sm:py-4 rounded-xl font-black text-base sm:text-lg tracking-widest uppercase border-2 border-white/30 text-white hover:bg-white/10 transition-all hover:scale-105" style={{ fontFamily: "Barlow Condensed" }}>🛡 Defense</button>
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
      setRemaining(r => {
        if (r <= 1) { if (ref.current) clearInterval(ref.current); onExpire(); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [seconds, onExpire]);
  const pct = remaining / seconds;
  const color = pct > 0.5 ? "#4AE84A" : pct > 0.25 ? "#E8E84A" : "#FF4655";
  return (
    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center font-black text-lg sm:text-xl border-4 transition-colors flex-shrink-0" style={{ borderColor: color, color, fontFamily: "Barlow Condensed" }}>
      {remaining}
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
  const [enabledMaps, setEnabledMaps] = useState<MapId[]>([...ACTIVE_MAP_IDS]);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(30);

  const handleLogo = (team: "A" | "B", e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    team === "A" ? setLogoA(url) : setLogoB(url);
  };

  // Hard cap at exactly 7 maps
  const toggleMap = (id: MapId) => {
    setEnabledMaps(prev => {
      if (prev.includes(id)) {
        // Deselect only if we have more than 1
        return prev.length > 1 ? prev.filter(m => m !== id) : prev;
      }
      // Select only if under cap
      return prev.length < 7 ? [...prev, id] : prev;
    });
  };

  const isActivePool = enabledMaps.length === ACTIVE_MAP_IDS.length && ACTIVE_MAP_IDS.every(id => enabledMaps.includes(id));
  const applyActiveFilter = () => setEnabledMaps([...ACTIVE_MAP_IDS]);

  const canStart = enabledMaps.length === 7;

  return (
    <div className="min-h-screen p-4 sm:p-8 max-w-4xl mx-auto" style={{ fontFamily: "Rajdhani, sans-serif" }}>
      <div className="text-center mb-8 sm:mb-12 pt-10 sm:pt-8">
        <div className="text-xs tracking-[0.4em] text-[#FF4655] font-bold mb-2 uppercase">Valorant</div>
        <h1 className="text-5xl sm:text-6xl font-black tracking-widest uppercase text-white" style={{ fontFamily: "Barlow Condensed, sans-serif" }}>Map Veto</h1>
        <p className="text-white/40 text-xs sm:text-sm tracking-widest mt-2 uppercase">Tournament Configuration</p>
      </div>

      {/* Teams */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 sm:mb-6">
        {(["A", "B"] as const).map(team => (
          <div key={team} className="rounded-2xl p-4 sm:p-6 border border-white/10 bg-white/5">
            <div className={`text-xs font-bold tracking-[0.3em] uppercase mb-3 sm:mb-4 ${team === "A" ? "text-[#FF4655]" : "text-blue-400"}`}>Team {team}</div>
            <input
              value={team === "A" ? teamA : teamB}
              onChange={e => team === "A" ? setTeamA(e.target.value) : setTeamB(e.target.value)}
              placeholder={`Team ${team}`}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white font-bold tracking-wider text-base sm:text-lg mb-3 sm:mb-4 outline-none focus:border-[#FF4655] transition-colors placeholder-white/30"
              style={{ fontFamily: "Barlow Condensed" }}
            />
            <label className="block text-xs text-white/40 tracking-widest uppercase mb-2">Logo (optional)</label>
            <label className="flex items-center gap-3 cursor-pointer bg-white/5 border border-white/10 rounded-xl px-4 py-3 hover:bg-white/10 transition">
              {(team === "A" ? logoA : logoB) ? (
                <img src={(team === "A" ? logoA : logoB)!} className="w-8 h-8 object-contain rounded" alt="logo" />
              ) : (
                <svg className="w-6 h-6 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              )}
              <span className="text-white/50 text-sm">{(team === "A" ? logoA : logoB) ? "Logo uploaded" : "Upload logo"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => handleLogo(team, e)} />
            </label>
          </div>
        ))}
      </div>

      {/* Format */}
      <div className="rounded-2xl p-4 sm:p-6 border border-white/10 bg-white/5 mb-4 sm:mb-6">
        <div className="text-white/60 text-xs font-bold tracking-[0.3em] uppercase mb-4">Match Format</div>
        <div className="flex gap-3">
          {(["bo1", "bo3", "bo5"] as Format[]).map(f => (
            <button key={f} onClick={() => setFormat(f)}
              className={`flex-1 py-3 sm:py-4 rounded-xl font-black text-lg sm:text-xl tracking-widest uppercase transition-all ${format === f ? "text-white scale-105" : "text-white/40 border border-white/20 hover:text-white/70"}`}
              style={{ fontFamily: "Barlow Condensed", background: format === f ? "#FF4655" : "transparent", boxShadow: format === f ? "0 0 20px #FF465544" : "none" }}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Map Pool */}
      <div className="rounded-2xl p-4 sm:p-6 border border-white/10 bg-white/5 mb-4 sm:mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-4">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="text-white/60 text-xs font-bold tracking-[0.3em] uppercase">Map Pool</div>
            <button
              onClick={applyActiveFilter}
              className={`px-3 py-1 rounded-lg text-xs font-bold tracking-widest uppercase transition-all border ${isActivePool ? "border-green-500 text-green-400 bg-green-500/10" : "border-white/20 text-white/50 hover:border-white/40 hover:text-white/80"}`}
              style={{ fontFamily: "Barlow Condensed" }}
            >
              {isActivePool ? "✓ Active Maps" : "Active Maps Only"}
            </button>
          </div>
          <div className={`text-xs font-bold tracking-wider ${enabledMaps.length === 7 ? "text-green-400" : "text-yellow-400"}`}>
            {enabledMaps.length} / 7 selected
          </div>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {ALL_MAPS.map(map => {
            const enabled = enabledMaps.includes(map.id);
            const accent = mapAccents[map.id];
            const isActive = ACTIVE_MAP_IDS.includes(map.id);
            const atCap = enabledMaps.length >= 7 && !enabled;
            return (
              <div key={map.id} onClick={() => toggleMap(map.id)}
                className={`relative rounded-xl overflow-hidden transition-all duration-200 ${atCap ? "cursor-not-allowed opacity-25" : "cursor-pointer hover:scale-105"}`}
                style={{ height: "68px", border: enabled ? `2px solid ${accent}` : "1px solid rgba(255,255,255,0.12)", boxShadow: enabled ? `0 0 12px ${accent}55` : "none", opacity: atCap ? 0.25 : enabled ? 1 : 0.5 }}
              >
                <img src={MAP_IMAGES[map.id]} alt={map.name} className="absolute inset-0 w-full h-full object-cover" draggable={false} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <div className={`absolute inset-0 bg-gradient-to-br ${mapGradients[map.id]}`} style={{ zIndex: -1 }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                {isActive && <div className="absolute top-1 left-1 w-3 h-3 rounded-full bg-green-500/90" title="Active Map" />}
                <div className="absolute bottom-0 left-0 right-0 px-1.5 pb-1">
                  <div className="font-black tracking-wider uppercase" style={{ fontFamily: "Barlow Condensed", fontSize: "9px", color: enabled ? accent : "rgba(255,255,255,0.5)", textShadow: "0 1px 6px rgba(0,0,0,1)" }}>{map.name}</div>
                </div>
                {enabled ? (
                  <div className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: accent }}>
                    <svg className="w-2.5 h-2.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </div>
                ) : (
                  <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-white/25 text-xs tracking-wider mt-3">Exactly 7 maps required · Click to swap · <span className="text-green-500/60">● Active pool</span></p>
      </div>

      {/* Options */}
      <div className="rounded-2xl p-4 sm:p-6 border border-white/10 bg-white/5 mb-6 sm:mb-8">
        <div className="text-white/60 text-xs font-bold tracking-[0.3em] uppercase mb-4">Options</div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div onClick={() => setTimerEnabled(v => !v)} className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${timerEnabled ? "bg-[#FF4655]" : "bg-white/20"}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${timerEnabled ? "left-7" : "left-1"}`} />
            </div>
            <span className="text-white/70 text-sm font-bold tracking-wider uppercase">Timer</span>
          </div>
          {timerEnabled && (
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-xs">Seconds:</span>
              <select value={timerSeconds} onChange={e => setTimerSeconds(Number(e.target.value))} className="bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-white text-sm font-bold outline-none">
                {[15, 20, 30, 45, 60].map(s => <option key={s} value={s}>{s}s</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {!canStart && <p className="text-center text-yellow-400 text-sm tracking-wider mb-4 font-bold">Select exactly 7 maps to continue ({enabledMaps.length}/7)</p>}
      <button
        onClick={() => onStart({ teamA: teamA || "Team A", teamB: teamB || "Team B", logoA, logoB, format, enabledMaps, timerEnabled, timerSeconds })}
        disabled={!canStart}
        className={`w-full py-4 sm:py-5 rounded-2xl font-black text-xl sm:text-2xl tracking-widest uppercase transition-all ${canStart ? "hover:scale-105" : "opacity-40 cursor-not-allowed"}`}
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

  const baseSequence = buildSequence(format);
  const sequence: VetoStep[] = baseSequence.map(step => ({
    action: step.action,
    teamIndex: step.teamIndex === 0 ? firstTeam : firstTeam === 0 ? 1 : 0,
  }));

  const activeMaps = ALL_MAPS.filter(m => enabledMaps.includes(m.id));

  const [mapStates, setMapStates] = useState<Record<string, MapState>>(() => {
    const s: Record<string, MapState> = {};
    activeMaps.forEach(m => { s[m.id] = "available"; });
    return s;
  });
  const [mapMeta, setMapMeta] = useState<Partial<Record<string, MapMeta>>>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sideModal, setSideModal] = useState<SideModalState | null>(null);
  const [timerKey, setTimerKey] = useState(0);

  const currentStep = stepIndex < sequence.length ? sequence[stepIndex] : undefined;

  // After all bans/picks, handle remaining maps as decider
  const triggerDecider = useCallback((
    states: Record<string, MapState>,
    meta: Partial<Record<string, MapMeta>>,
    hist: HistoryEntry[]
  ) => {
    const remaining = activeMaps.filter(m => states[m.id] === "available");

    if (remaining.length === 0) {
      // All maps resolved, just finish
      onFinish({ mapStates: states as Record<MapId, MapState>, mapMeta: meta as Partial<Record<MapId, MapMeta>>, history: hist, activeMaps, deciderTeamIndex: firstTeam });
      return;
    }

    // Coin toss to decide who picks side for decider (simple random since toss already happened)
    const deciderSideTeam = Math.round(Math.random()) === 0 ? firstTeam : firstTeam === 0 ? 1 : 0;

    if (remaining.length === 1) {
      const deciderMap = remaining[0];
      const newStates = { ...states, [deciderMap.id]: "decider" as MapState };
      setMapStates(newStates);
      const newHist = [...hist, { text: `${deciderMap.name} is the DECIDER`, type: "decider" as const }];
      setHistory(newHist);
      setTimeout(() => {
        setSideModal({ mapId: deciderMap.id as MapId, mapName: deciderMap.name, teamIndex: deciderSideTeam, isDecider: true });
      }, 700);
    } else {
      // Multiple maps remaining — shouldn't happen with standard pool but handle gracefully
      // Ban extras, keep first as decider
      const deciderMap = remaining[0];
      const newStates = { ...states };
      newStates[deciderMap.id] = "decider";
      remaining.slice(1).forEach(m => { newStates[m.id] = "banned"; });
      setMapStates(newStates);
      const newHist = [...hist, { text: `${deciderMap.name} is the DECIDER`, type: "decider" as const }];
      setHistory(newHist);
      setTimeout(() => {
        setSideModal({ mapId: deciderMap.id as MapId, mapName: deciderMap.name, teamIndex: deciderSideTeam, isDecider: true });
      }, 700);
    }
  }, [activeMaps, firstTeam, onFinish]);

  const handleMapClick = useCallback((map: ValorantMap) => {
    if (!currentStep || sideModal) return;
    const step = currentStep;

    if (step.action === "BAN") {
      const newStates = { ...mapStates, [map.id]: "banned" as MapState };
      const newHist: HistoryEntry[] = [...history, { text: `${teams[step.teamIndex]} banned ${map.name}`, type: "ban", teamIndex: step.teamIndex }];
      setMapStates(newStates);
      setHistory(newHist);
      const next = stepIndex + 1;
      setStepIndex(next);
      setTimerKey(k => k + 1);
      if (next >= sequence.length) {
        triggerDecider(newStates, mapMeta, newHist);
      }
    } else {
      // PICK — need side selection first
      setSideModal({ mapId: map.id as MapId, mapName: map.name, teamIndex: step.teamIndex });
    }
  }, [currentStep, mapStates, history, teams, stepIndex, sequence.length, sideModal, mapMeta, triggerDecider]);

  const handleSideSelect = useCallback((side: Side) => {
    if (!sideModal) return;
    const { mapId, mapName, teamIndex, isDecider } = sideModal;

    const newMeta = { ...mapMeta, [mapId]: { picker: teams[teamIndex], side } };
    const sideText = side === "attack" ? "Attack" : "Defense";

    if (isDecider) {
      const newHist: HistoryEntry[] = [...history, { text: `${teams[teamIndex]} chose ${sideText} on ${mapName} (Decider)`, type: "pick", teamIndex }];
      setMapMeta(newMeta);
      setHistory(newHist);
      setSideModal(null);
      onFinish({
        mapStates: mapStates as Record<MapId, MapState>,
        mapMeta: newMeta as Partial<Record<MapId, MapMeta>>,
        history: newHist,
        activeMaps,
        deciderTeamIndex: teamIndex,
      });
      return;
    }

    const newStates = { ...mapStates, [mapId]: "picked" as MapState };
    const newHist: HistoryEntry[] = [...history, { text: `${teams[teamIndex]} picked ${mapName} (${sideText})`, type: "pick", teamIndex }];
    setMapMeta(newMeta);
    setMapStates(newStates);
    setHistory(newHist);
    setSideModal(null);
    const next = stepIndex + 1;
    setStepIndex(next);
    setTimerKey(k => k + 1);
    if (next >= sequence.length) {
      triggerDecider(newStates, newMeta, newHist);
    }
  }, [sideModal, mapMeta, mapStates, history, teams, stepIndex, sequence.length, triggerDecider, activeMaps, onFinish]);

  const handleTimerExpire = useCallback(() => {
    if (!currentStep || sideModal) return;
    const available = activeMaps.filter(m => mapStates[m.id] === "available");
    if (!available.length) return;
    handleMapClick(available[Math.floor(Math.random() * available.length)]);
  }, [currentStep, sideModal, activeMaps, mapStates, handleMapClick]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && sideModal && !sideModal.isDecider) setSideModal(null); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [sideModal]);

  const actionColor = currentStep?.action === "BAN" ? "#FF4655" : "#4AE8AA";
  const teamColors = ["#FF4655", "#4A9AFF"];

  return (
    <div className="min-h-screen p-3 sm:p-4 flex flex-col" style={{ fontFamily: "Rajdhani, sans-serif" }}>
      {/* Header */}
      <div className="rounded-2xl p-3 sm:p-4 mb-3 border border-white/10 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.04)" }}>
        <Logo name={teamA} logo={logoA} side="left" />
        <div className="text-center px-2">
          <div className="text-white/30 text-xs tracking-[0.4em] uppercase mb-1">{format.toUpperCase()}</div>
          <div className="text-xl sm:text-2xl font-black tracking-widest text-white" style={{ fontFamily: "Barlow Condensed" }}>VS</div>
        </div>
        <Logo name={teamB} logo={logoB} side="right" />
      </div>

      {/* Turn indicator */}
      {currentStep ? (
        <div className="rounded-2xl p-3 sm:p-4 mb-3 text-center border" style={{ borderColor: actionColor + "44", background: actionColor + "11" }}>
          <div className="flex items-center justify-center gap-3">
            {timerEnabled && <Timer key={timerKey} seconds={timerSeconds} onExpire={handleTimerExpire} />}
            <div>
              <div className="text-xs tracking-[0.4em] uppercase mb-1" style={{ color: teamColors[currentStep.teamIndex] }}>{teams[currentStep.teamIndex]}</div>
              <div className="text-3xl sm:text-4xl font-black tracking-widest" style={{ fontFamily: "Barlow Condensed", color: actionColor }}>{currentStep.action}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-3 sm:p-4 mb-3 text-center border border-yellow-400/30 bg-yellow-400/5">
          <div className="text-yellow-400 font-bold tracking-widest uppercase animate-pulse text-sm sm:text-base" style={{ fontFamily: "Barlow Condensed" }}>
            ⭐ Selecting Decider Side...
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-3 flex-1">
        {/* Map grid */}
        <div className="flex-1">
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
            {activeMaps.map(map => (
              <MapCard
                key={map.id}
                map={map}
                state={mapStates[map.id]}
                onClick={() => handleMapClick(map)}
                sideAttacker={mapStates[map.id] === "picked" && mapMeta[map.id]?.side === "attack" ? mapMeta[map.id]!.picker : null}
                disabled={!currentStep || !!sideModal}
              />
            ))}
          </div>
        </div>

        {/* History */}
        <div className="lg:w-56 xl:w-64 rounded-2xl p-3 sm:p-4 border border-white/10 flex flex-col" style={{ background: "rgba(255,255,255,0.04)", maxHeight: "60vh", minHeight: "120px" }}>
          <div className="text-xs font-bold tracking-[0.3em] text-white/40 uppercase mb-3">Veto History</div>
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {history.length === 0 && <div className="text-white/20 text-xs tracking-wider text-center mt-4">No actions yet</div>}
            {history.map((h, i) => (
              <div key={i} className="text-xs rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 border font-bold leading-snug" style={{
                background: h.type === "ban" ? "rgba(255,70,85,0.1)" : h.type === "pick" ? "rgba(74,232,170,0.1)" : "rgba(255,215,0,0.1)",
                borderColor: h.type === "ban" ? "rgba(255,70,85,0.3)" : h.type === "pick" ? "rgba(74,232,170,0.3)" : "rgba(255,215,0,0.3)",
                color: h.type === "ban" ? "#FF4655" : h.type === "pick" ? "#4AE8AA" : "#FFD700",
                fontFamily: "Rajdhani", letterSpacing: "0.04em",
              }}>{h.text}</div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="text-xs text-white/30 tracking-wider text-center">Step {Math.min(stepIndex, sequence.length)} / {sequence.length}</div>
          </div>
        </div>
      </div>

      {sideModal && <SideSelectModal mapName={sideModal.mapName} teamName={teams[sideModal.teamIndex]} onSelect={handleSideSelect} isDecider={sideModal.isDecider} />}
    </div>
  );
}

// ─── SummaryScreen ────────────────────────────────────────────────────────────
function SummaryScreen({ config, result, onReset }: { config: MatchConfig; result: VetoResult; onReset: () => void }) {
  const { teamA, teamB, format } = config;
  const { mapStates, mapMeta, activeMaps } = result;
  const picks = activeMaps.filter(m => mapStates[m.id as MapId] === "picked");
  const decider = activeMaps.find(m => mapStates[m.id as MapId] === "decider");

  const copyResult = () => {
    const lines = [
      `${format.toUpperCase()} — ${teamA} vs ${teamB}`, "",
      ...picks.map((m, i) => { const meta = mapMeta[m.id]; return `Map ${i + 1}: ${m.name}${meta ? ` — ${meta.picker} (${meta.side === "attack" ? "ATK" : "DEF"})` : ""}`; }),
      decider ? (() => { const meta = mapMeta[decider.id]; return `Decider: ${decider.name}${meta ? ` — ${meta.picker} (${meta.side === "attack" ? "ATK" : "DEF"})` : ""}`; })() : "",
    ].filter(Boolean);
    navigator.clipboard.writeText(lines.join("\n"));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8" style={{ fontFamily: "Rajdhani, sans-serif" }}>
      <div className="max-w-2xl w-full pt-8">
        <div className="text-center mb-6 sm:mb-8">
          <div className="text-xs tracking-[0.4em] text-[#FF4655] font-bold mb-2 uppercase">Match Summary</div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-widest uppercase text-white mb-2" style={{ fontFamily: "Barlow Condensed" }}>{format.toUpperCase()} Ready</h1>
          <div className="flex items-center justify-center gap-4 text-white/50 text-sm">
            <span className="font-bold tracking-wider">{teamA}</span><span>vs</span><span className="font-bold tracking-wider">{teamB}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 overflow-hidden mb-5" style={{ background: "rgba(255,255,255,0.04)" }}>
          {picks.map((m, i) => {
            const meta = mapMeta[m.id]; const accent = mapAccents[m.id as MapId];
            return (
              <div key={m.id} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 border-b border-white/5" style={{ borderLeft: `4px solid ${accent}` }}>
                <div className="text-white/40 text-sm font-bold w-5 text-center" style={{ fontFamily: "Barlow Condensed" }}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-lg sm:text-xl tracking-wider uppercase truncate" style={{ fontFamily: "Barlow Condensed", color: accent }}>{m.name}</div>
                  {meta && <div className="text-white/50 text-xs sm:text-sm">{meta.picker} starts {meta.side === "attack" ? "⚔ Attack" : "🛡 Defense"}</div>}
                </div>
                <div className="text-xs font-bold tracking-widest uppercase px-2 sm:px-3 py-1 rounded-lg flex-shrink-0" style={{ background: accent + "22", color: accent }}>PICK</div>
              </div>
            );
          })}
          {decider && (() => {
            const meta = mapMeta[decider.id]; const accent = mapAccents[decider.id as MapId];
            return (
              <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4" style={{ borderLeft: `4px solid ${accent}`, background: accent + "11" }}>
                <div className="text-white/40 text-sm font-bold w-5 text-center">★</div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-lg sm:text-xl tracking-wider uppercase truncate" style={{ fontFamily: "Barlow Condensed", color: accent }}>{decider.name}</div>
                  {meta && <div className="text-white/50 text-xs sm:text-sm">{meta.picker} starts {meta.side === "attack" ? "⚔ Attack" : "🛡 Defense"}</div>}
                </div>
                <div className="text-xs font-bold tracking-widest uppercase px-2 sm:px-3 py-1 rounded-lg animate-pulse flex-shrink-0" style={{ background: accent + "33", color: accent }}>DECIDER</div>
              </div>
            );
          })()}
        </div>

        <div className="flex gap-3 sm:gap-4">
          <button onClick={copyResult} className="flex-1 py-3 sm:py-4 rounded-xl border border-white/20 text-white font-black text-base sm:text-lg tracking-widest uppercase hover:bg-white/10 transition-all" style={{ fontFamily: "Barlow Condensed" }}>Copy Result</button>
          <button onClick={onReset} className="flex-1 py-3 sm:py-4 rounded-xl font-black text-base sm:text-lg tracking-widest uppercase transition-all hover:scale-105" style={{ fontFamily: "Barlow Condensed", background: "#FF4655", boxShadow: "0 0 20px #FF465544" }}>Reset Veto</button>
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
  const stages: Stage[] = ["setup", "cointoss", "veto", "summary"];

  return (
    <>
      <style>{FONTS}</style>
      <div className="min-h-screen text-white" style={{ background: "radial-gradient(ellipse at top left, #1a0a0e 0%, #0a0a14 40%, #08080f 100%)", backgroundAttachment: "fixed" }}>
        <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-40" style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 2px)" }} />
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 flex gap-2">
          {stages.map((s, i) => (
            <div key={s} className="w-2 h-2 rounded-full transition-all" style={{ background: s === stage ? "#FF4655" : i < stages.indexOf(stage) ? "rgba(255,70,85,0.4)" : "rgba(255,255,255,0.2)" }} />
          ))}
        </div>
        <CreditsCard />
        {stage === "setup"    && <SetupScreen onStart={cfg => { setConfig(cfg); setStage("cointoss"); }} />}
        {stage === "cointoss" && config && <CoinToss teamA={config.teamA} teamB={config.teamB} onComplete={first => { setFirstTeam(first); setStage("veto"); }} />}
        {stage === "veto"     && config && <VetoScreen config={config} firstTeam={firstTeam} onFinish={res => { setResult(res); setStage("summary"); }} />}
        {stage === "summary"  && config && result && <SummaryScreen config={config} result={result} onReset={handleReset} />}
      </div>
    </>
  );
}
