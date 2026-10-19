import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { ColorBand, ResistorTask } from "../types";
import { COLORS, TOLERANCES, colorByValue, formatOhms, toleranceByValue, trim } from "../lib/resistors";

export function Header({ onHome, onHistory }: { onHome: () => void; onHistory: () => void }) {
  return (
    <header>
      <a className="brand" href="#setup" aria-label="Four-band trainer home" onClick={(event) => { event.preventDefault(); onHome(); }}>
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none"><path d="M2 12h4m12 0h4M6 12l2-4 3 8 3-8 2 4h2" stroke="#8A8635" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 9.3v5.4m3-5.4v5.4" stroke="#D06224" strokeWidth="2"/></svg>
        </span>
        <span>Four-band trainer</span>
      </a>
      <div className="header-actions"><button className="quiet-button" type="button" onClick={onHistory}>Round history</button></div>
    </header>
  );
}

export function Footer() {
  return <footer>Four-band resistor practice · Progress is saved on this device</footer>;
}

export function Button({ children, variant = "primary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "quiet" }) {
  const classes = variant === "primary" ? "primary-button" : variant === "secondary" ? "primary-button secondary-button" : "quiet-button";
  return <button className={`${classes} ${className}`.trim()} {...props}>{children}</button>;
}

export function Card({ children, className = "", ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={`card ${className}`.trim()} {...props}>{children}</section>;
}

interface ResistorDiagramProps {
  task: ResistorTask;
  noTolerance: boolean;
  answers?: Array<number | null>;
  onSelectBand?: (band: number, element: SVGGElement) => void;
  onBandKeyDown?: (event: React.KeyboardEvent<SVGGElement>, band: number) => void;
  missingBands?: number[];
  disabled?: boolean;
}

export function ResistorDiagram({ task, noTolerance, answers, onSelectBand, onBandKeyDown, missingBands = [], disabled = false }: ResistorDiagramProps) {
  const bands = task.type === "code" ? answers ?? [null, null, null, noTolerance ? 5 : null] : task.colors;
  const xPositions = [204, 255, 306, 357];
  return (
    <svg className="resistor-svg" viewBox="0 0 560 202" role="img" aria-label={task.type === "value" ? "Resistor with four color bands" : "Select resistor color bands"}>
      <defs><linearGradient id="bodyShade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f5e5bf"/><stop offset=".48" stopColor="#e9d19e"/><stop offset="1" stopColor="#d8ba83"/></linearGradient></defs>
      <path d="M20 101H164M396 101H540" stroke="#aaa69c" strokeWidth="5" strokeLinecap="round"/>
      <path d="M160 101c0-33 16-54 39-54h162c23 0 39 21 39 54s-16 54-39 54H199c-23 0-39-21-39-54Z" fill="url(#bodyShade)" stroke="#c9b58e" strokeWidth="1.5"/>
      <path d="M172 75c8-17 16-22 27-23h162c12 1 20 7 27 23" fill="none" stroke="rgba(255,255,255,.52)" strokeWidth="3" strokeLinecap="round"/>
      <path d="M164 76c7-12 18-19 32-19h3v88h-3c-14 0-25-7-32-19m232-50c-7-12-18-19-32-19h-3v88h3c14 0 25-7 32-19" fill="#d9c395" opacity=".62"/>
      {bands.map((code, index) => {
        const fixedTolerance = task.type === "code" && noTolerance && index === 3;
        const color = code === null || code === undefined
          ? "#f8f3e5"
          : (index === 3 ? toleranceByValue(Number(code)) : colorByValue(Number(code)))?.hex ?? "#f8f3e5";
        const stroke = ["#f8f3e5", "#f2c84b"].includes(color) ? "#bdb4a4"
          : color === "#d5d9de" ? "#8b9299"
          : color === "#d4a017" ? "#9e7410"
          : color;
        return (
          <g
            key={index}
            className={`band-hit${fixedTolerance ? " band-fixed" : ""}${missingBands.includes(index) ? " band-missing" : ""}`}
            data-band={index}
            tabIndex={task.type === "code" && !disabled && !fixedTolerance ? 0 : undefined}
            role={task.type === "code" && !disabled && !fixedTolerance ? "button" : undefined}
            aria-label={task.type === "code" && !fixedTolerance ? `Choose color for band ${index + 1}` : undefined}
            onClick={(event) => {
              if (task.type === "code" && !disabled && !fixedTolerance) onSelectBand?.(index, event.currentTarget);
            }}
            onKeyDown={(event) => onBandKeyDown?.(event, index)}
          >
            <rect className="band-focus" x={xPositions[index] - 13} y="60" width="26" height="82" rx="3" fill={color} stroke={stroke} strokeWidth="1"/>
            {task.type === "code" && !disabled && !fixedTolerance && <title>Click to choose band {index + 1}</title>}
          </g>
        );
      })}
      <text x="280" y="190" textAnchor="middle" fontFamily="system-ui,sans-serif" fontSize="11" fill="#9a917f" letterSpacing="1.5">4-BAND AXIAL RESISTOR</text>
    </svg>
  );
}

interface RadialPickerProps {
  band: number;
  position: { x: number; y: number };
  onPick: (value: number) => void;
  onClose: () => void;
}

export function RadialPicker({ band, position, onPick, onClose }: RadialPickerProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const colors = band === 3 ? TOLERANCES : band === 2 ? COLORS : COLORS.filter((color) => color.value >= 0);
  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>(".color-choice")?.focus();
  }, []);
  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Element && !menuRef.current?.contains(event.target) && !event.target.closest(".band-hit")) onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("click", closeOnOutsideClick);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("click", closeOnOutsideClick);
    };
  }, [onClose]);
  return (
    <div ref={menuRef} className="radial-menu open" role="menu" aria-label="Choose resistor band color" style={{ left: position.x, top: position.y }}>
      <button className="radial-center" type="button" onClick={onClose}>Cancel</button>
      {colors.map((color, index) => {
        const angle = -Math.PI / 2 + index / colors.length * Math.PI * 2;
        const radius = colors.length > 9 ? 85 : 78;
        const style: CSSProperties = {
          left: `${115 + Math.cos(angle) * radius - 15}px`,
          top: `${115 + Math.sin(angle) * radius - 15}px`,
          background: color.hex,
        };
        return <button
          key={`${color.name}-${index}`}
          type="button"
          className="color-choice"
          role="menuitem"
          aria-label={color.name}
          aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
          title={color.name}
          style={style}
          onKeyDown={(event) => {
            const step = event.key === "ArrowRight" ? 1
              : event.key === "ArrowLeft" ? -1
              : event.key === "ArrowUp" || event.key === "ArrowDown" ? colors.length / 2
              : 0;
            if (!step) return;
            event.preventDefault();
            const nextIndex = (index + step + colors.length) % colors.length;
            menuRef.current?.querySelectorAll<HTMLButtonElement>(".color-choice")[nextIndex]?.focus();
          }}
          onClick={() => onPick(color.value)}
        ><span>{color.name}</span></button>;
      })}
    </div>
  );
}

export function HistoryDialog({ open, rounds, onClose, onClear }: { open: boolean; rounds: RoundLike[]; onClose: () => void; onClear: () => void }) {
  if (!open) return null;
  const total = rounds.reduce((sum, round) => sum + round.total, 0);
  const correct = rounds.reduce((sum, round) => sum + round.correct, 0);
  const average = total ? rounds.reduce((sum, round) => sum + round.average * round.total, 0) / total : 0;
  return (
    <div className="history-overlay open" role="dialog" aria-modal="true" aria-labelledby="historyTitle" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="history-modal card">
        <div className="history-head"><h2 id="historyTitle">Your practice history</h2><Button variant="quiet" onClick={onClose}>Close</Button></div>
        {!rounds.length ? <div className="history-empty">No completed rounds yet.<br/>Finish a practice round and your progress will be saved here.</div> : <>
          <div className="history-total">
            <div><span>Rounds</span><strong>{rounds.length}</strong></div>
            <div><span>Overall accuracy</span><strong>{total ? Math.round(correct / total * 100) : 0}%</strong></div>
            <div><span>Avg. response</span><strong>{trim(average)}s</strong></div>
          </div>
          <div>{rounds.map((round) => <div className="history-entry" key={round.id}>
            <div><strong>{round.mode === "value" ? "Value by code" : round.mode === "code" ? "Code by value" : round.mode === "mixed" ? "Mixed practice" : round.mode} · {round.correct}/{round.total}</strong><small>{new Date(round.date).toLocaleString()} · {round.total ? Math.round(round.correct / round.total * 100) : 0}% accuracy</small></div>
            <span className={`task-result ${round.correct === round.total ? "good" : "bad"}`}>{trim(round.average)}s avg</span>
          </div>)}</div>
          <div style={{ textAlign: "right", marginTop: 14 }}><Button variant="quiet" onClick={onClear}>Clear history</Button></div>
        </>}
      </section>
    </div>
  );
}

export type RoundLike = {
  id: number;
  date: string;
  mode: string;
  total: number;
  correct: number;
  average: number;
};

export function LiveGraph({ tasks }: { tasks: ResistorTask[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !tasks.length) return;
    const pixelRatio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    context.scale(pixelRatio, pixelRatio);
    context.clearRect(0, 0, width, height);
    const data = tasks.slice(-20);
    const left = 40, right = 10, top = 12, bottom = 24;
    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;
    const maxTime = Math.max(1, ...data.map((task) => task.elapsed));
    const yForTime = (seconds: number) => {
      const clampedTime = Math.max(0, Math.min(maxTime, seconds));
      return top + chartHeight * (1 - clampedTime / maxTime);
    };
    const ticks = [maxTime, maxTime * 2 / 3, maxTime / 3, 0];
    context.strokeStyle = "#ebe6dd";
    ticks.forEach((tick) => {
      const y = yForTime(tick);
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(width - right, y);
      context.stroke();
    });
    context.font = "10px system-ui";
    context.fillStyle = "#8a8635";
    context.textAlign = "right";
    ticks.forEach((tick) => {
      context.fillText(tick === 0 ? "0s" : `${trim(tick)}s`, left - 6, yForTime(tick) + 3);
    });
    const step = data.length > 1 ? chartWidth / (data.length - 1) : 0;
    context.beginPath();
    data.forEach((task, index) => {
      const x = left + index * step;
      const timeLeft = task.correct ? Math.max(0, maxTime - task.elapsed) : 0;
      const y = yForTime(timeLeft);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.strokeStyle = "#8a8635";
    context.lineWidth = 2;
    context.stroke();
    data.forEach((task, index) => {
      const x = left + index * step;
      const timeLeft = task.correct ? Math.max(0, maxTime - task.elapsed) : 0;
      const y = yForTime(timeLeft);
      context.beginPath();
      context.arc(x, y, 3.5, 0, Math.PI * 2);
      context.fillStyle = task.correct ? "#8a8635" : "#b64d35";
      context.fill();
    });
    context.textAlign = "left";
    context.fillStyle = "#77736a";
    context.fillText("1", left, height - 5);
    context.textAlign = "right";
    context.fillText(String(data.length), width - right, height - 5);
  }, [tasks]);

  if (!tasks.length) return <div className="graph-empty">Your accuracy and response time will appear here.</div>;
  return <canvas ref={canvasRef} className="live-graph" aria-label="Time remaining per question on a uniform scale; incorrect answers are zero seconds"/>;
}

export function ColorDots({ task, noTolerance }: { task: ResistorTask; noTolerance: boolean }) {
  const bands = task.colors.slice(0, noTolerance ? 3 : 4);
  return <div className="feedback-colors" aria-label="Correct band colors">{bands.map((value, index) => {
    const band: ColorBand | undefined = index === 3 ? toleranceByValue(value) : colorByValue(value);
    if (!band) return null;
    return <span className="feedback-color" aria-label={`Band ${index + 1}: ${band.name}`} key={index}><span className="feedback-color-dot" style={{ background: band.hex }}/><span>{band.name}</span></span>;
  })}</div>;
}

export function ResistancePrompt({ task, noTolerance }: { task: ResistorTask; noTolerance: boolean }) {
  return <div className="prompt-stack"><div className="prompt-value">{formatOhms(task.ohms)}</div><div className="prompt-tolerance">Tolerance ±{noTolerance ? 5 : task.tolerance}%</div></div>;
}

export function BandName({ value, index }: { value: number; index: number }): ReactNode {
  return index === 3 ? toleranceByValue(value)?.name : colorByValue(value)?.name;
}
