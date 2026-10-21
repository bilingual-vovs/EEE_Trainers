import { useState } from "react";
import type { ResistorTask, Round } from "../types";
import { colorByValue, formatOhms, modeLabel, toleranceByValue, trim } from "../lib/resistors";
import { Button, Card } from "./Shared";

interface ResultsScreenProps {
  round: Round;
  correction: boolean;
  onHome: () => void;
  onRepeat: () => void;
  onCorrectErrors: () => void;
  onHistory: () => void;
}

export function ResultsScreen({ round, correction, onHome, onRepeat, onCorrectErrors, onHistory }: ResultsScreenProps) {
  const [onlyErrors, setOnlyErrors] = useState(false);
  const accuracy = round.total ? Math.round(round.correct / round.total * 100) : 0;
  const maxTime = Math.max(1, ...round.tasks.map((task) => task.elapsed));
  const bins = Array.from({ length: 8 }, () => 0);
  round.tasks.forEach((task) => bins[Math.min(7, Math.floor(task.elapsed / maxTime * 7.999))]++);
  const tasks = onlyErrors ? round.tasks.filter((task) => !task.correct) : round.tasks;
  const largestBin = Math.max(1, ...bins);

  return <>
    <div className="results-header"><div><div className="eyebrow">{correction ? "Correction round complete" : "Round complete"}</div><h1>{accuracy}% correct</h1><p className="intro results-intro">{round.correct} of {round.total} questions answered correctly{correction ? " in your correction round" : ""}.</p></div><Button variant="quiet" onClick={onHome}>← Back to setup</Button></div>
    <div className="summary-grid">
      <Stat label="Correct answers" value={`${round.correct}/${round.total}`}/>
      <Stat label="Accuracy" value={`${accuracy}%`}/>
      <Stat label="Average time" value={`${trim(round.average)}s`}/>
      <Stat label="Round type" value={`${round.exercise === "smd" ? "SMD · " : ""}${round.mode === "value" ? "Read code" : round.mode === "code" ? "Place code" : round.mode === "mixed" ? "Mixed" : round.mode}`}/>
    </div>
    <div className="results-grid">
      <Card className="chart-card"><h2>Time distribution</h2>
        <div className="distribution">{bins.map((count, index) => {
          const height = count ? Math.max(4, count / largestBin * 115) : 0;
          const low = maxTime * index / 8;
          const high = maxTime * (index + 1) / 8;
          return <div className="dist-column" key={index}><div className="dist-bar" style={{ height }} data-count={count}><span className="dist-label">{trim(low)}–{trim(high)}s</span></div></div>;
        })}</div>
        <div className="chart-legend"><span>Questions by response time</span><span>{trim(Math.max(...round.tasks.map((task) => task.elapsed), 0))}s max</span></div>
      </Card>
      <Card className="task-list-card"><h2>Question review</h2>
        <div className="list-tools"><span className="field-note">{round.tasks.length} completed</span><label className="toggle-label"><input type="checkbox" checked={onlyErrors} onChange={(event) => setOnlyErrors(event.currentTarget.checked)}/>Only errors</label></div>
        <div className="task-list">{tasks.length ? tasks.map((task) => <TaskRow task={task} round={round} index={round.tasks.indexOf(task)} key={`${round.id}-${round.tasks.indexOf(task)}`}/>) : <div className="history-empty">No errors in this round. Great work!</div>}</div>
      </Card>
    </div>
    <div className="result-actions">
      {round.tasks.some((task) => !task.correct) && <Button onClick={onCorrectErrors}>Practice missed questions</Button>}
      <Button variant="secondary" onClick={onRepeat}>Run this round again</Button>
      <Button variant="quiet" onClick={onHistory}>Overall statistics</Button>
    </div>
  </>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="stat-card"><span>{label}</span><strong className={label === "Round type" ? "stat-round-type" : undefined}>{value}</strong></div>;
}

function TaskRow({ task, round, index }: { task: ResistorTask; round: Round; index: number }) {
  const expected = round.exercise === "smd"
    ? task.type === "value"
      ? `${task.smdCode ?? "—"}${task.smdToleranceCode ?? ""} · ${formatOhms(task.ohms)} ±${task.tolerance}%`
      : `${formatOhms(task.ohms)} ±${task.tolerance}% · ${task.smdCode ?? "—"}${task.smdToleranceCode ?? ""}`
    : task.type === "value"
    ? `${formatOhms(task.ohms)}${round.noTolerance ? "" : ` ±${task.tolerance}%`}`
    : `${formatOhms(task.ohms)}${round.noTolerance ? "" : ` ±${task.tolerance}%`} · ${task.colors.slice(0, round.noTolerance ? 3 : 4).map((value, band) => (band === 3 ? toleranceByValue(value) : colorByValue(value))?.name).join(" / ")}`;
  return <div className="task-row">
    <span className="task-index">{String(index + 1).padStart(2, "0")}</span>
    <div className="task-main"><strong>{modeLabel(task.type)}: {expected}</strong><span>Your answer: {task.response || "No answer"} · {trim(task.elapsed)}s{task.timedOut ? " · timed out" : ""}</span></div>
    <span className={`task-result ${task.correct ? "good" : "bad"}`}>{task.correct ? "Correct" : "Missed"}</span>
  </div>;
}
