import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { ResistorTask, Settings } from "../types";
import { formatOhms, parseResistance } from "../lib/resistors";
import { Button, Card, LiveGraph } from "./Shared";

interface SmdPracticeScreenProps {
  task: ResistorTask;
  index: number;
  total: number;
  continuous: boolean;
  settings: Settings;
  recentTasks: ResistorTask[];
  onEvaluate: (result: Pick<ResistorTask, "correct" | "elapsed" | "timedOut" | "response">) => void;
  onNext: () => void;
  onEnd: () => void;
}

type Submission = Pick<ResistorTask, "correct" | "elapsed" | "timedOut" | "response">;

export function SmdPracticeScreen({ task, index, total, continuous, settings, recentTasks, onEvaluate, onNext, onEnd }: SmdPracticeScreenProps) {
  const [valueAnswer, setValueAnswer] = useState("");
  const [codeAnswer, setCodeAnswer] = useState("");
  const [toleranceAnswer, setToleranceAnswer] = useState(settings.noTolerance ? String(task.tolerance) : "");
  const [secondsLeft, setSecondsLeft] = useState(settings.time);
  const [notice, setNotice] = useState("");
  const valueInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const startedAtRef = useRef(performance.now());
  const submitRef = useRef<(timedOut?: boolean) => void>(() => undefined);
  const evaluated = task.response !== undefined;
  const code = task.smdCode;

  if (!code) throw new Error("SMD practice requires a generated SMD marking.");

  useEffect(() => {
    startedAtRef.current = performance.now();
    if (task.type === "value") valueInputRef.current?.focus({ preventScroll: true });
    else codeInputRef.current?.focus({ preventScroll: true });
  }, [task]);

  useEffect(() => {
    if (!settings.time || evaluated) return;
    const start = performance.now();
    const tick = () => {
      const remaining = Math.max(0, settings.time - (performance.now() - start) / 1000);
      setSecondsLeft(remaining);
      if (remaining <= 0) submitRef.current(true);
    };
    const interval = window.setInterval(tick, 100);
    tick();
    return () => window.clearInterval(interval);
  }, [settings.time, evaluated, task]);

  function evaluateAnswer(timedOut: boolean): Omit<Submission, "elapsed" | "timedOut"> {
    if (task.type === "value") {
      const enteredValue = parseResistance(valueAnswer);
      const enteredTolerance = settings.noTolerance ? 5 : Number(toleranceAnswer.replace(",", ".").replace("%", "").trim());
      const correct = Number.isFinite(enteredValue)
        && Math.abs(enteredValue - task.ohms) < Math.max(1e-10, task.ohms * 1e-8)
        && (settings.noTolerance || (Number.isFinite(enteredTolerance) && Math.abs(enteredTolerance - task.tolerance) < 1e-8));
      const response = settings.noTolerance
        ? valueAnswer.trim() || (timedOut ? "—" : "")
        : `${valueAnswer.trim() || "—"} ±${toleranceAnswer.trim() || "—"}%`;
      return { correct, response };
    }
    const normalized = codeAnswer.trim().replace(/\s+/g, "").toUpperCase();
    const expected = `${code}${task.smdToleranceCode ?? ""}`.toUpperCase();
    const correct = settings.noTolerance ? normalized === code : normalized === expected;
    return { correct, response: codeAnswer.trim() || (timedOut ? "—" : "") };
  }

  function submit(timedOut = false) {
    if (evaluated) return;
    if (!timedOut) {
      const missingValue = task.type === "value" && !valueAnswer.trim();
      const missingTolerance = task.type === "value" && !settings.noTolerance && !toleranceAnswer.trim();
      const missingCode = task.type === "code" && !codeAnswer.trim();
      if (missingValue || missingTolerance || missingCode) {
        setNotice(missingValue ? "Enter a resistance before checking." : missingTolerance ? "Enter a tolerance before checking." : "Enter an SMD marking before checking.");
        (missingValue ? valueInputRef.current : missingCode ? codeInputRef.current : document.getElementById("smdToleranceAnswer"))?.focus();
        return;
      }
    }
    onEvaluate({
      ...evaluateAnswer(timedOut),
      elapsed: (performance.now() - startedAtRef.current) / 1000,
      timedOut,
    });
  }
  submitRef.current = submit;

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" || event.defaultPrevented) return;
    if (evaluated) {
      if ((event.target as HTMLElement).closest("button")) return;
      event.preventDefault();
      onNext();
      return;
    }
    if ((event.target as HTMLElement).closest("button, input, select, textarea, a")) return;
    event.preventDefault();
    submit();
  }

  const lastQuestion = !continuous && index === total - 1;
  const timerClass = secondsLeft <= 5 ? "timer warning" : "timer";
  const expectedValue = `${formatOhms(task.ohms)} ±${task.tolerance}%`;
  const codeReferenceSuffix = task.smdToleranceCode ?? `±${task.tolerance}%`;

  return <div onKeyDown={handleKeyDown}>
    <div className="stage-top">
      <div className="stage-title"><div className="eyebrow">{settings.mode === "mixed" ? "Mixed SMD practice" : "SMD resistor practice"}</div><h1>Question {index + 1}</h1></div>
      <div className="progress-box">
        <div className="progress-label">{index + 1} {continuous ? "in continuous practice" : `of ${total}`}</div>
        <div className="progress-track"><div className="progress-fill" style={{ width: continuous ? "100%" : `${((index + 1) / total) * 100}%` }}/></div>
        <Button variant="quiet" className="end-early-button" type="button" onClick={onEnd}>End early</Button>
      </div>
    </div>
    <Card className="exercise-card">
      <div className="exercise-head"><div><div className="eyebrow">{task.type === "value" ? "Decode the marking" : "Write the marking"}</div><h2>{task.type === "value" ? "What is the resistance?" : "What marking belongs on this resistor?"}</h2></div>
        {settings.time > 0 && !evaluated && <div className={timerClass} aria-live="off">{Math.ceil(secondsLeft)}s</div>}
      </div>
      {task.type === "code" && <div className="prompt-stack"><div className="prompt-value">{formatOhms(task.ohms)}</div><div className="prompt-tolerance">Tolerance ±{task.tolerance}%</div></div>}
      <div className={`smd-resistor ${evaluated ? task.correct ? "correct" : "incorrect" : ""}`}>
        <div className="smd-pad left"/>
        <div className="smd-body">
          {task.type === "value"
            ? <span className="smd-marking">{code}{task.smdToleranceCode ?? ""}</span>
            : <>
              <input ref={codeInputRef} className="smd-marking-input" type="text" value={codeAnswer} onChange={(event) => { setCodeAnswer(event.currentTarget.value); setNotice(""); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); evaluated ? onNext() : submit(); } }} autoComplete="off" aria-label="SMD resistor marking"/>
              {settings.noTolerance && <span className="smd-answer-suffix" aria-label={`Tolerance reference ${codeReferenceSuffix}`}>{codeReferenceSuffix}</span>}
            </>}
        </div>
        <div className="smd-pad right"/>
      </div>
      <p className="resistor-caption">{task.type === "value" ? "Read the printed marking" : `Enter the numeric marking${settings.noToleranceLetter ? "" : " and tolerance letter when shown"}`}</p>
      {task.type === "value" && <div className="answer-row">
        <div className="answer-field"><label htmlFor="smdValueAnswer">Resistance</label><input ref={valueInputRef} className="answer-input" id="smdValueAnswer" value={valueAnswer} onChange={(event) => { setValueAnswer(event.currentTarget.value); setNotice(""); }} onKeyDown={(event) => {
          if (event.key === "Enter") { event.preventDefault(); evaluated ? onNext() : submit(); }
          if (event.key === "Tab" && !event.shiftKey && !settings.noTolerance) { event.preventDefault(); document.getElementById("smdToleranceAnswer")?.focus(); }
        }} type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 4.7 kΩ" aria-label="Resistance value"/></div>
        <div className="answer-field"><label htmlFor="smdToleranceAnswer">Tolerance (%)</label><input className="answer-input" id="smdToleranceAnswer" value={settings.noTolerance ? String(task.tolerance) : toleranceAnswer} onChange={(event) => { setToleranceAnswer(event.currentTarget.value); setNotice(""); }} onKeyDown={(event) => {
          if (event.key === "Enter") { event.preventDefault(); evaluated ? onNext() : submit(); }
          if (event.key === "Tab" && event.shiftKey) { event.preventDefault(); valueInputRef.current?.focus(); }
        }} type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 5" aria-label={settings.noTolerance ? `Fixed tolerance of ${task.tolerance} percent` : "Tolerance in percent"} readOnly={settings.noTolerance}/></div>
      </div>}
      {task.type === "value" && <p className="unit-hint answer-hint">Use a dot or comma for decimals. Prefixes: k, M, G, m, u/µ, n.</p>}
      {(notice || evaluated) && <div className={`feedback show ${evaluated ? task.correct ? "correct" : "incorrect" : "incorrect"}`} role="status">
        {evaluated ? <><strong>{task.timedOut ? "Time is up." : task.correct ? "Correct — nicely done." : "Not quite."}</strong>
          {task.type === "value" ? `Correct answer: ${expectedValue}` : `Correct marking: ${code}${task.smdToleranceCode ?? ""}`}</> : notice}
      </div>}
      <div className="submit-row">{evaluated
        ? <Button type="button" onClick={onNext}>{lastQuestion ? "Check results" : "Next"}</Button>
        : <Button type="button" onClick={() => submit()}>{task.type === "value" ? "Check answer" : "Check marking"}</Button>}
      </div>
    </Card>
    {continuous && <Card className="graph-card"><div className="graph-heading"><strong>Recent practice</strong><span>Time left · uniform scale · incorrect answers are 0 · last 20 questions</span></div><LiveGraph tasks={recentTasks}/></Card>}
  </div>;
}
