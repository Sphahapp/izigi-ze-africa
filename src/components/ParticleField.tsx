import { useEffect, useRef } from "react";

interface ParticleFieldProps {
  density?: number; // particles per 10,000px^2
  maxSize?: number; // max radius px
  speed?: number; // base speed multiplier
  className?: string;
}

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
  alpha: number;
  twinklePhase: number;
};

export const ParticleField = ({ density = 0.012, maxSize = 1.8, speed = 0.6, className }: ParticleFieldProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const parent = canvas.parentElement as HTMLElement | null;
    if (!parent) return;

    const initParticles = () => {
      const { clientWidth: w, clientHeight: h } = parent;
      canvas.width = w;
      canvas.height = h;

      const targetCount = Math.max(12, Math.floor((w * h) / 10000 * density));
      const arr: Particle[] = [];
      for (let i = 0; i < targetCount; i++) {
        arr.push(spawnParticle(w, h, maxSize, speed));
      }
      particlesRef.current = arr;
    };

    const spawnParticle = (w: number, h: number, maxR: number, spd: number): Particle => {
      const r = Math.random() * (maxR - 0.4) + 0.4;
      const angle = Math.random() * Math.PI * 2;
      const base = spd * (0.15 + Math.random() * 0.85);
      const hue = (Math.random() * 360) | 0;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: Math.cos(angle) * base,
        vy: Math.sin(angle) * base,
        r,
        hue,
        alpha: 0.35 + Math.random() * 0.6,
        twinklePhase: Math.random() * Math.PI * 2,
      };
    };

    const step = (t: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // soft glow trail
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.fillRect(0, 0, w, h);

      const ps = particlesRef.current;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        p.x += p.vx;
        p.y += p.vy;
        p.twinklePhase += 0.02 + Math.random() * 0.02;

        // gentle wrap
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        const twinkle = 0.75 + 0.25 * Math.sin(p.twinklePhase);
        const a = Math.max(0.05, Math.min(1, p.alpha * twinkle));

        // draw particle with tiny LED-like glow
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(6, p.r * 6));
        grd.addColorStop(0, `hsla(${p.hue}, 90%, 65%, ${a})`);
        grd.addColorStop(0.5, `hsla(${(p.hue + 40) % 360}, 95%, 55%, ${a * 0.6})`);
        grd.addColorStop(1, `hsla(${(p.hue + 80) % 360}, 90%, 45%, 0)`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(4, p.r * 4), 0, Math.PI * 2);
        ctx.fill();

        // core LED dot
        ctx.fillStyle = `hsla(${p.hue}, 100%, 80%, ${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(step);
    };

    initParticles();
    rafRef.current = requestAnimationFrame(step);

    // keep canvas sized to parent
    const ro = new ResizeObserver(() => initParticles());
    ro.observe(parent);
    resizeObserverRef.current = ro;

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      resizeObserverRef.current?.disconnect();
    };
  }, [density, maxSize, speed]);

  return <canvas ref={canvasRef} className={className ?? "absolute inset-0"} />;
};

export default ParticleField;




