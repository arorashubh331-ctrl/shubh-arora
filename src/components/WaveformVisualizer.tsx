import React, { useEffect, useRef } from 'react';
import { AssistantState, ThemeConfig } from '../types/assistant';

interface WaveformVisualizerProps {
  state: AssistantState;
  theme: ThemeConfig;
  getVisualizerData: () => {
    level: number;
    frequencies: Uint8Array;
    source: 'user' | 'assistant' | 'idle';
  };
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  state,
  theme,
  getVisualizerData,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let smoothedLevel = 0;
    let rotation = 0;
    let phase = 0;

    // Floating ambient particles
    const particleCount = 45;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 2 + 0.8,
      speedX: (Math.random() - 0.5) * 0.4,
      speedY: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.5 + 0.2,
      orbitAngle: Math.random() * Math.PI * 2,
      orbitDistance: 90 + Math.random() * 120,
    }));

    // Handle high DPI
    const handleResize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      const { level, frequencies, source } = getVisualizerData();

      // Smooth volume interpolation
      const targetLevel = Math.min(1.0, level * 1.8);
      smoothedLevel += (targetLevel - smoothedLevel) * 0.2;

      phase += 0.04 + smoothedLevel * 0.08;
      rotation += 0.008 + (state === 'connecting' ? 0.04 : 0) + (state === 'speaking' ? 0.015 : 0);

      // Render floating ambient particles
      for (const p of particles) {
        p.orbitAngle += 0.005 + smoothedLevel * 0.02;
        const currentDist = p.orbitDistance + Math.sin(phase + p.orbitAngle) * (15 + smoothedLevel * 40);
        const px = centerX + Math.cos(p.orbitAngle) * currentDist;
        const py = centerY + Math.sin(p.orbitAngle) * currentDist;

        ctx.beginPath();
        ctx.arc(px, py, p.radius * (1 + smoothedLevel * 1.5), 0, Math.PI * 2);
        ctx.fillStyle = theme.primary;
        ctx.globalAlpha = p.alpha * (state === 'disconnected' ? 0.3 : 0.85);
        ctx.shadowBlur = 10;
        ctx.shadowColor = theme.secondary;
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;

      // Base radius of central visual aura
      const baseRadius = Math.min(width, height) * 0.22;
      const reactiveRadius = baseRadius + smoothedLevel * 45;

      // Draw subtle outer glow ring
      const gradGlow = ctx.createRadialGradient(
        centerX,
        centerY,
        baseRadius * 0.4,
        centerX,
        centerY,
        reactiveRadius * 1.7
      );
      gradGlow.addColorStop(0, theme.glow);
      gradGlow.addColorStop(0.5, theme.secondary + '20');
      gradGlow.addColorStop(1, 'transparent');

      ctx.fillStyle = gradGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, reactiveRadius * 1.7, 0, Math.PI * 2);
      ctx.fill();

      // Draw radial frequency / wave petals if audio is active
      const points = 64;
      const angleStep = (Math.PI * 2) / points;

      // Outer fluctuating wave ring
      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const angle = i * angleStep + rotation;
        let distortion = 0;

        if (frequencies.length > 0 && (state === 'speaking' || state === 'listening')) {
          const freqIndex = Math.floor((i % points) * (frequencies.length / points));
          const freqVal = (frequencies[freqIndex] || 0) / 255;
          distortion = freqVal * 38;
        } else if (state === 'connecting') {
          distortion = Math.sin(angle * 5 + phase * 3) * 12;
        } else {
          // Gentle idle breathing
          distortion = Math.sin(angle * 3 + phase) * 6;
        }

        const r = reactiveRadius + distortion;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();

      ctx.strokeStyle = theme.primary;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = theme.primary;
      ctx.shadowBlur = state === 'speaking' ? 22 : 12;
      ctx.stroke();

      // Inner counter-rotating harmonic ring
      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const angle = i * angleStep - rotation * 1.3;
        let innerDistortion = 0;

        if (frequencies.length > 0 && (state === 'speaking' || state === 'listening')) {
          const freqIndex = Math.floor(((points - i) % points) * (frequencies.length / points));
          const freqVal = (frequencies[freqIndex] || 0) / 255;
          innerDistortion = freqVal * 24;
        } else {
          innerDistortion = Math.cos(angle * 4 - phase * 1.5) * 5;
        }

        const r = Math.max(20, reactiveRadius * 0.78 + innerDistortion);
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();

      ctx.strokeStyle = theme.secondary;
      ctx.lineWidth = 1.8;
      ctx.shadowColor = theme.secondary;
      ctx.shadowBlur = state === 'speaking' ? 18 : 8;
      ctx.stroke();

      // Draw bottom flowing horizontal voice wave ribbon
      if (state !== 'disconnected') {
        const ribbonY = height * 0.78;
        const ribbonHeight = 35 * (0.3 + smoothedLevel * 1.2);

        // Ribbon 1
        ctx.beginPath();
        for (let x = 0; x <= width; x += 4) {
          const normX = x / width;
          const envelope = Math.sin(normX * Math.PI); // Pin ends to zero
          const wave =
            Math.sin(normX * 12 + phase * 2) * 0.5 +
            Math.sin(normX * 24 - phase * 1.4) * 0.3 +
            Math.cos(normX * 6 + phase) * 0.2;
          const y = ribbonY + wave * ribbonHeight * envelope;

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        const gradLine = ctx.createLinearGradient(0, 0, width, 0);
        gradLine.addColorStop(0, 'transparent');
        gradLine.addColorStop(0.3, theme.primary);
        gradLine.addColorStop(0.7, theme.secondary);
        gradLine.addColorStop(1, 'transparent');

        ctx.strokeStyle = gradLine;
        ctx.lineWidth = 2.2;
        ctx.shadowColor = theme.accent;
        ctx.shadowBlur = 14;
        ctx.stroke();

        // Ribbon 2 (Subtle mirror)
        ctx.beginPath();
        for (let x = 0; x <= width; x += 4) {
          const normX = x / width;
          const envelope = Math.sin(normX * Math.PI);
          const wave =
            Math.cos(normX * 14 - phase * 1.8) * 0.5 +
            Math.sin(normX * 8 + phase * 0.8) * 0.4;
          const y = ribbonY + wave * (ribbonHeight * 0.65) * envelope;

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        ctx.strokeStyle = theme.secondary + '77';
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 8;
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [state, theme, getVisualizerData]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
};
