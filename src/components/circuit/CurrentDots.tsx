import { useEffect, useState, useRef } from 'react';

interface Wire {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  current?: number; // amps — undefined means use totalCurrent
}

interface CurrentDotsProps {
  wires: Wire[];
  current: number; // total circuit current, used for animation speed
}

const MIN_CURRENT = 0.0001;
const DOT_SPACING = 40;

export function CurrentDots({ wires, current }: CurrentDotsProps) {
  const [offset, setOffset] = useState(0);
  const animRef = useRef<number>(0);
  const lastTime = useRef<number>(0);

  const speed = Math.min(2 + current * 15, 80);

  useEffect(() => {
    function animate(time: number) {
      if (lastTime.current === 0) lastTime.current = time;
      const delta = (time - lastTime.current) / 16;
      lastTime.current = time;
      setOffset((prev) => (prev + speed * delta * 0.3) % DOT_SPACING);
      animRef.current = requestAnimationFrame(animate);
    }
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [speed]);

  const dots: { cx: number; cy: number; opacity: number }[] = [];

  for (const wire of wires) {
    const wireCurrent = wire.current ?? current;
    if (wireCurrent < MIN_CURRENT) continue; // no dots on non-conducting wires

    const dx = wire.x2 - wire.x1;
    const dy = wire.y2 - wire.y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 5) continue;

    const numDots = Math.floor(length / DOT_SPACING) + 1;
    // Scale opacity slightly with current fraction (all branches still visible but dimmer when less current)
    const opacity = Math.min(0.5 + (wireCurrent / current) * 0.5, 1.0);

    for (let i = 0; i < numDots; i++) {
      const t = ((i * DOT_SPACING + offset) % length) / length;
      dots.push({
        cx: wire.x1 + dx * t,
        cy: wire.y1 + dy * t,
        opacity,
      });
    }
  }

  return (
    <g>
      {dots.map((dot, i) => (
        <circle
          key={i}
          cx={dot.cx}
          cy={dot.cy}
          r={2.5}
          fill="#60a5fa"
          opacity={dot.opacity}
        />
      ))}
    </g>
  );
}
