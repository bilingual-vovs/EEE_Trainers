import { useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import type { ESeries, ExerciseMode, Round, Settings } from "../types";
import { SERIES_OPTIONS, formatDuration, trim } from "../lib/resistors";
import { Card, Button } from "./Shared";

interface SetupScreenProps {
  rounds: Round[];
  onStart: (settings: Settings) => void;
}

const DEFAULT_TIME = 99;

export function SetupScreen({ rounds, onStart }: SetupScreenProps) {
  const [rollsText, setRollsText] = useState("10");
  const [timeText, setTimeText] = useState("No time limit");
  const [timePosition, setTimePosition] = useState(DEFAULT_TIME);
  const [mode, setMode] = useState<ExerciseMode>("mixed");
  const [series, setSeries] = useState<ESeries>("none");
  const [noTolerance, setNoTolerance] = useState(false);
  const [error, setError] = useState("");

  const estimate = useMemo(() => {
    const count = Number(rollsText);
    const seconds = Number(timeText);
    const times = rounds.flatMap((round) => round.tasks
      .filter((task) => task.elapsed > 0 && !task.timedOut
        && (series === "none" || round.series === series)
        && (mode === "mixed" || task.type === mode))
      .map((task) => task.elapsed));
    const average = times.length ? times.reduce((sum, value) => sum + value, 0) / times.length : (mode === "code" ? 18 : 15);
    const perTask = seconds > 0 ? Math.min(average, seconds) : average;
    const validCount = /^(∞|infinity)$/i.test(rollsText) ? Infinity : count;
    return {
      label: validCount === Infinity ? `≈ ${trim(perTask)} sec / question` : `≈ ${formatDuration(perTask * (Number.isFinite(count) && count > 0 ? count : 10))} total`,
      source: times.length ? "Based on your practice history" : "Typical estimate until your first round",
    };
  }, [mode, rounds, rollsText, series, timeText]);

  function updateRolls(value: string) {
    setRollsText(value);
    if (/^(∞|infinity)$/i.test(value.trim())) {
      setRollsPosition(1000);
      return;
    }
    const count = Number(value);
    if (Number.isSafeInteger(count) && count >= 5) {
      const position = Math.log(count / 5) / Math.log(1_000_000 / 5) * 999;
      setRollsPosition(Math.min(999, Math.round(position)));
    }
  }

  const [rollsPosition, setRollsPosition] = useState(() => Math.log(10 / 5) / Math.log(1_000_000 / 5) * 999);
  function updateTimePosition(position: number) {
    setTimePosition(position);
    setTimeText(position === 99 ? "No time limit" : String(position + 2));
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const count = /^(∞|infinity)$/i.test(rollsText.trim()) ? Infinity : Number(rollsText);
    const time = /^(no\s*time\s*limit|none|0)$/i.test(timeText.trim()) ? 0 : Number(timeText);
    if (count !== Infinity && (!Number.isSafeInteger(count) || count < 5)) {
      setError("Choose at least 5 questions, or enter ∞ for continuous practice.");
      return;
    }
    if (!Number.isFinite(time) || time < 0 || (time > 0 && (!Number.isInteger(time) || time < 2 || time > 100))) {
      setError("Time limit must be 0 (none) or a whole number from 2 to 100 seconds.");
      return;
    }
    setError("");
    onStart({ rolls: count, time, mode, series, noTolerance });
  }

  function updateTimeText(value: string) {
    setTimeText(value);
    if (/^(0|no\s*time\s*limit|none)$/i.test(value.trim())) {
      setTimePosition(99);
      setTimeText("No time limit");
      return;
    }
    const seconds = Number(value);
    if (Number.isInteger(seconds) && seconds >= 2 && seconds <= 100) setTimePosition(seconds - 2);
  }

  const rollsInputStyle: CSSProperties = { width: `${Math.max(8, rollsText.length + 4)}ch` };
  const timeInputStyle: CSSProperties = { width: `${Math.max(8, timeText.length + 4)}ch` };

  return (
    <>
      <div className="eyebrow">Learn the language of resistors</div>
      <h1>Read the bands.<br/>Know the value.</h1>
      <p className="intro">Build confidence with four-band resistor codes. Practice reading values, placing colors, or switch between both.</p>
      <div className="setup-grid">
        <Card className="setup-card" aria-labelledby="setupTitle">
          <div className="card-title"><h2 id="setupTitle">Set up your practice</h2><span className="estimate-chip" aria-live="polite"><strong>{estimate.label}</strong>{estimate.source}</span></div>
          <form onSubmit={submit}>
            <div className="field">
              <div className="field-head"><label htmlFor="roundsInput">Number of questions</label><span className="field-note">5 or more</span></div>
              <div className="slider-row">
                <div><input id="roundsRange" type="range" min="0" max="1000" value={rollsPosition} onChange={(event) => {
                  const position = Number(event.currentTarget.value);
                  setRollsPosition(position);
                  setRollsText(position === 1000 ? "∞" : String(Math.round(5 * Math.pow(1_000_000 / 5, position / 999))));
                }} aria-label="Number of questions, logarithmic slider"/><div className="range-ends"><span>5</span><span>∞</span></div></div>
                <div className="input-wrap"><input id="roundsInput" type="text" inputMode="numeric" value={rollsText} onChange={(event) => updateRolls(event.currentTarget.value)} style={rollsInputStyle} aria-label="Number of questions"/><span className="input-suffix">questions</span></div>
              </div>
            </div>
            <div className="field">
              <div className="field-head"><label htmlFor="timeInput">Time per question</label><span className="field-note">0 means no limit</span></div>
              <div className="slider-row">
                <div><input id="timeRange" type="range" min="0" max="99" value={timePosition} onChange={(event) => updateTimePosition(Number(event.currentTarget.value))} aria-label="Time limit, linear slider"/><div className="range-ends"><span>2 sec</span><span>No time limit</span></div></div>
                <div className="input-wrap">{timePosition === 99
                  ? <span className="input-suffix">No time limit</span>
                  : <><input id="timeInput" type="text" inputMode="numeric" value={timeText} onChange={(event) => updateTimeText(event.currentTarget.value)} style={timeInputStyle} aria-label="Time limit in seconds"/><span className="input-suffix">seconds</span></>}
                </div>
              </div>
            </div>
            <div className="field">
              <div className="field-head"><label htmlFor="seriesSelect">Preferred value series</label><span className="field-note">Four-band values</span></div>
              <div className="select-wrap"><select id="seriesSelect" value={series} onChange={(event) => setSeries(event.currentTarget.value as ESeries)} aria-label="Preferred E series">{SERIES_OPTIONS.map((option) => <option key={option} value={option}>{option === "none" ? "No set — all values" : option}</option>)}</select></div>
              <div className="field-note" style={{ marginTop: 6 }}>Four-band values use two significant digits; E-series values are rounded to the nearest representable value.</div>
            </div>
            <div className="field"><label className="toggle-label"><input type="checkbox" checked={noTolerance} onChange={(event) => setNoTolerance(event.currentTarget.checked)}/>No tolerance (practice the first three bands only)</label></div>
            <div className="field">
              <div className="field-head"><span className="field-label">Exercise type</span></div>
              <div className="mode-options">
                <ModeOption value="value" selected={mode} onSelect={setMode} title="Value by code" detail="Read the colors and enter the resistance"/>
                <ModeOption value="code" selected={mode} onSelect={setMode} title="Code by value" detail="Choose the right color for each band"/>
                <ModeOption value="mixed" selected={mode} onSelect={setMode} title="Mixed" detail="Switch modes in clusters of at least two"/>
              </div>
            </div>
            {error && <p className="feedback show incorrect" role="alert">{error}</p>}
            <div className="start-row"><small>Keyboard friendly · Press Enter to check</small><Button type="submit">Start practice <span aria-hidden="true">→</span></Button></div>
          </form>
        </Card>
        <aside className="card info-card">
          <div><div className="eyebrow">Quick reference</div><h2>Two digits. One multiplier. One tolerance.</h2><p>Each band adds a piece of the resistance value. Learn the color sequence as you practice.</p></div>
          <div className="legend">{[
            ["#252522", "0 · Black"], ["#795038", "1 · Brown"], ["#c44738", "2 · Red"], ["#e06b1b", "3 · Orange"],
            ["#f2c84b", "4 · Yellow"], ["#64814a", "5 · Green"], ["#477ba0", "6 · Blue"], ["#82649b", "7 · Violet"],
          ].map(([color, label]) => <div className="legend-item" key={label}><span className="legend-swatch" style={{ background: color }}/>{label}</div>)}</div>
        </aside>
      </div>
    </>
  );
}

function ModeOption({ value, selected, onSelect, title, detail }: { value: ExerciseMode; selected: ExerciseMode; onSelect: (mode: ExerciseMode) => void; title: string; detail: string }) {
  return <label className="mode-option"><input type="radio" name="mode" value={value} checked={selected === value} onChange={() => onSelect(value)}/><span className="mode-copy"><strong>{title}</strong><small>{detail}</small></span></label>;
}
