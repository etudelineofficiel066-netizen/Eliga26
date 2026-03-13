import { useEffect, useRef, useState } from "react";
import { Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WinnerCelebrationProps {
  tournamentId: string;
  tournamentName: string;
  playerName: string;
  isWinner?: boolean;
  prizeAmount?: number | null;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  type: "circle" | "star" | "rect";
  rotation: number;
  rotSpeed: number;
}

const FIREWORK_COLORS = [
  "#FFD700", "#FF4500", "#00BFFF", "#7FFF00", "#FF69B4",
  "#FFA500", "#00FF7F", "#FF1493", "#1E90FF", "#ADFF2F",
  "#FF6347", "#DA70D6", "#40E0D0", "#FFD700", "#FFFFFF",
];

export default function WinnerCelebration({ tournamentId, tournamentName, playerName, isWinner = false, prizeAmount }: WinnerCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const [visible, setVisible] = useState(true);
  const [phase, setPhase] = useState<"enter" | "show" | "exit">("enter");

  // Mark as seen in localStorage
  useEffect(() => {
    localStorage.setItem(`celebration_seen_${tournamentId}`, "1");
  }, [tournamentId]);

  // Champion fanfare using Web Audio API
  useEffect(() => {
    const playFanfare = () => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const master = ctx.createGain();
        master.gain.setValueAtTime(0.35, ctx.currentTime);
        master.connect(ctx.destination);

        // Victory fanfare notes: C5 E5 G5 C6 — then held chord
        const melody = [
          { freq: 523.25, start: 0.0, dur: 0.22 },
          { freq: 659.25, start: 0.2, dur: 0.22 },
          { freq: 783.99, start: 0.4, dur: 0.22 },
          { freq: 1046.5, start: 0.6, dur: 1.0  },
          // Final full chord
          { freq: 523.25, start: 0.65, dur: 1.5 },
          { freq: 659.25, start: 0.65, dur: 1.5 },
          { freq: 783.99, start: 0.65, dur: 1.5 },
        ];

        melody.forEach(({ freq, start, dur }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(master);
          osc.type = "triangle";
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0, ctx.currentTime + start);
          gain.gain.linearRampToValueAtTime(0.6, ctx.currentTime + start + 0.03);
          gain.gain.setValueAtTime(0.6, ctx.currentTime + start + dur - 0.08);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur);
          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + dur + 0.05);
        });

        // Percussion hit at start
        const bufferSize = ctx.sampleRate * 0.15;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03));
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.15, ctx.currentTime);
        noiseGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
        noise.connect(noiseGain);
        noiseGain.connect(master);
        noise.start(ctx.currentTime);
      } catch (_) {}
    };

    const timer = setTimeout(playFanfare, 300);
    return () => clearTimeout(timer);
  }, []);

  // Auto-dismiss after 10 seconds
  useEffect(() => {
    const timer1 = setTimeout(() => setPhase("show"), 100);
    const timer2 = setTimeout(() => setPhase("exit"), 9500);
    const timer3 = setTimeout(() => setVisible(false), 10200);
    return () => { clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3); };
  }, []);

  // Fireworks canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const spawnBurst = (x: number, y: number) => {
      const count = 60 + Math.floor(Math.random() * 40);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
        const speed = 2 + Math.random() * 6;
        const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
        const type = Math.random() < 0.4 ? "star" : Math.random() < 0.5 ? "rect" : "circle";
        particlesRef.current.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color,
          size: 2 + Math.random() * 5,
          life: 1,
          maxLife: 0.6 + Math.random() * 0.4,
          type,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.2,
        });
      }
    };

    // Launch bursts at intervals
    const launchPattern = () => {
      const w = canvas.width;
      const h = canvas.height;
      // Random burst positions focused on upper 2/3
      const positions = [
        [w * 0.2, h * 0.2], [w * 0.8, h * 0.25], [w * 0.5, h * 0.15],
        [w * 0.35, h * 0.4], [w * 0.65, h * 0.35], [w * 0.1, h * 0.45],
        [w * 0.9, h * 0.3], [w * 0.5, h * 0.5],
      ];
      const pos = positions[Math.floor(Math.random() * positions.length)];
      spawnBurst(pos[0] + (Math.random() - 0.5) * 80, pos[1] + (Math.random() - 0.5) * 60);
    };

    // Initial burst and interval
    launchPattern();
    launchPattern();
    const interval = setInterval(launchPattern, 400);

    const drawStar = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rotation: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const outerAngle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        const innerAngle = outerAngle + Math.PI / 5;
        ctx.lineTo(Math.cos(outerAngle) * r, Math.sin(outerAngle) * r);
        ctx.lineTo(Math.cos(innerAngle) * r * 0.4, Math.sin(innerAngle) * r * 0.4);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current = particlesRef.current.filter(p => p.life > 0);

      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12; // gravity
        p.vx *= 0.99;
        p.life -= 0.008 / p.maxLife;
        p.rotation += p.rotSpeed;

        const alpha = Math.max(0, p.life);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;

        if (p.type === "star") {
          drawStar(ctx, p.x, p.y, p.size, p.rotation);
        } else if (p.type === "rect") {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillRect(-p.size / 2, -p.size * 1.5, p.size, p.size * 3);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      clearInterval(interval);
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.82)" }}
      onClick={() => setVisible(false)}
    >
      {/* Fireworks video background */}
      <video
        src="/fireworks.mp4"
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ objectFit: "cover", opacity: 0.7, mixBlendMode: "screen" }}
      />

      {/* Canvas fireworks overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: "100%", height: "100%", mixBlendMode: "screen" }}
      />

      {/* Close button */}
      <button
        className="absolute top-4 right-4 z-10 text-white/60 hover:text-white transition-colors p-2"
        onClick={() => setVisible(false)}
        data-testid="button-close-celebration"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Center content */}
      <div
        className="relative z-10 flex flex-col items-center gap-4 px-6 text-center"
        style={{
          transform: phase === "enter" ? "scale(0.3) translateY(80px)" : phase === "exit" ? "scale(0.8) translateY(-30px)" : "scale(1) translateY(0)",
          opacity: phase === "enter" ? 0 : phase === "exit" ? 0 : 1,
          transition: phase === "enter" ? "transform 0.7s cubic-bezier(0.34,1.56,0.64,1), opacity 0.5s ease"
                    : phase === "exit" ? "transform 0.7s ease-in, opacity 0.6s ease-in"
                    : "none",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Glowing ring + trophy */}
        <div className="relative flex items-center justify-center">
          {/* Pulsing glow rings */}
          <div className="absolute w-48 h-48 rounded-full bg-yellow-400/20 animate-ping" style={{ animationDuration: "1.5s" }} />
          <div className="absolute w-36 h-36 rounded-full bg-yellow-400/30 animate-ping" style={{ animationDuration: "1.2s", animationDelay: "0.3s" }} />
          <div className="absolute w-32 h-32 rounded-full bg-yellow-300/20" />

          {/* Trophy lifting animation */}
          <div
            className="relative z-10 flex items-center justify-center w-28 h-28 rounded-full shadow-2xl"
            style={{
              background: "linear-gradient(135deg, #F59E0B, #FBBF24, #FCD34D, #F59E0B)",
              boxShadow: "0 0 60px 20px rgba(251,191,36,0.5), 0 0 120px 40px rgba(245,158,11,0.2)",
              animation: "trophy-lift 1s cubic-bezier(0.34,1.56,0.64,1) forwards",
            }}
          >
            <span style={{ fontSize: "3.5rem", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))" }}>🏆</span>
          </div>
        </div>

        {/* Champion text */}
        <div className="space-y-1.5">
          <div
            className="text-4xl font-black tracking-wide"
            style={{
              background: "linear-gradient(135deg, #FFD700, #FFF8DC, #FFD700)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "none",
              filter: "drop-shadow(0 2px 4px rgba(245,158,11,0.8))",
              animation: "text-glow 2s ease-in-out infinite alternate",
            }}
          >
            {isWinner ? "CHAMPION !" : "🏆 TOURNOI TERMINÉ !"}
          </div>
          <p className="text-2xl font-bold text-white drop-shadow-lg">{playerName}</p>
          <p className="text-sm text-yellow-200/80 max-w-xs leading-relaxed">
            {isWinner ? (
              <>🎉 Vous avez remporté le tournoi<br /></>
            ) : (
              <>👑 Remporte le tournoi<br /></>
            )}
            <span className="font-semibold text-yellow-300">« {tournamentName} »</span>
          </p>
          {isWinner && prizeAmount && prizeAmount > 0 && (
            <div className="mt-2 px-5 py-2 rounded-full bg-gradient-to-r from-yellow-500 to-amber-400 shadow-lg shadow-yellow-500/40">
              <p className="text-sm font-black text-black">
                💰 {prizeAmount.toLocaleString()} XAF remportés !
              </p>
            </div>
          )}
        </div>

        {/* Stars decoration */}
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map(i => (
            <span
              key={i}
              style={{
                fontSize: "1.4rem",
                animation: `star-pop 0.4s ${0.1 * i + 0.8}s cubic-bezier(0.34,1.56,0.64,1) both`,
              }}
            >⭐</span>
          ))}
        </div>

        <button
          className="mt-2 px-6 py-2 rounded-full text-sm font-semibold text-black bg-gradient-to-r from-yellow-400 to-amber-400 hover:from-yellow-300 hover:to-amber-300 transition-all shadow-lg"
          onClick={() => setVisible(false)}
          data-testid="button-claim-victory"
        >
          Continuer
        </button>
      </div>

      <style>{`
        @keyframes trophy-lift {
          0% { transform: translateY(60px) scale(0.5); opacity: 0; }
          60% { transform: translateY(-12px) scale(1.1); opacity: 1; }
          80% { transform: translateY(4px) scale(0.97); }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes text-glow {
          from { filter: drop-shadow(0 2px 4px rgba(245,158,11,0.6)); }
          to { filter: drop-shadow(0 4px 12px rgba(245,158,11,1)) drop-shadow(0 0 30px rgba(255,215,0,0.8)); }
        }
        @keyframes star-pop {
          0% { transform: scale(0) rotate(-30deg); opacity: 0; }
          70% { transform: scale(1.3) rotate(10deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
