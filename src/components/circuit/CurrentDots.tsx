import { useEffect, useState, useRef } from 'react';

interface Wire {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface CurrentDotsProps {
  wires: Wire[];
  current: number;
}

export function CurrentDots({ wires, current }: CurrentDotsProps) {
  const [offset, setOffset] = useState(0);
  const animRef = useRef<number>(0);
  const lastTime = useRef<number>(0);

  const speed = Math.min(2 + current * 15, 80); // pixels per frame-ish

  useEffect(() => {
    function animate(time: number) {
      if (lastTime.current === 0) {
        lastTime.current = time;
      }
      const delta = (time - lastTime.current) / 16; // normalize to ~60fps
      lastTime.current = time;
      setOffset((prev) => (prev + speed * delta * 0.3) % 40);
      animRef.current = requestAnimationFrame(animate);
    }
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [speed]);

  // Generate dots along each wire segment
  const dots: { cx: number; cy: number }[] = [];
  const dotSpacing = 40;

  for (const wire of wires) {
    const dx = wire.x2 - wire.x1;
    const dy = wire.y2 - wire.y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 5) continue;

    const numDots = Math.floor(length / dotSpacing) + 1;

    for (let i = 0; i < numDots; i++) {
      const t = ((i * dotSpacing + offset) % length) / length;
      dots.push({
        cx: wire.x1 + dx * t,
        cy: wire.y1 + dy * t,
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
          opacity={0.8}
        />
      ))}
    </g>
  );
}
