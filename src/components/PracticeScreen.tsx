import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { ResistorTask, Settings } from "../types";
import { colorByValue, formatOhms, parseResistance, toleranceByValue } from "../lib/resistors";
import { Button, Card, ColorDots, LiveGraph, RadialPicker, ResistorDiagram } from "./Shared";

interface PracticeScreenProps {
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

export function PracticeScreen({ task, index, total, continuous, settings, recentTasks, onEvaluate, onNext, onEnd }: PracticeScreenProps) {
  const [valueAnswer, setValueAnswer] = useState("");
  const [toleranceAnswer, setToleranceAnswer] = useState(settings.noTolerance ? "5" : "");
  const [answers, setAnswers] = useState<Array<number | null>>(task.type === "code" ? [...task.answers] : []);
  const [notice, setNotice] = useState("");
  const [missingInputs, setMissingInputs] = useState(false);
  const [missingBands, setMissingBands] = useState<number[]>([]);
  const [picker, setPicker] = useState<{ band: number; x: number; y: number } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(settings.time);
  const valueInputRef = useRef<HTMLInputElement>(null);
  const startedAtRef = useRef(performance.now());
  const submitRef = useRef<(timedOut?: boolean) => void>(() => undefined);
  const evaluated = task.response !== undefined;

  useEffect(() => {
    startedAtRef.current = performance.now();
    if (task.type === "value") valueInputRef.current?.focus({ preventScroll: true });
    else document.querySelector<SVGGElement>(".band-hit[tabindex='0']")?.focus({ preventScroll: true });
  }, [task]);

  useEffect(() => {
    if (evaluated) document.querySelector<HTMLButtonElement>(".submit-row button")?.focus({ preventScroll: true });
  }, [evaluated]);

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
  // evaluateAnswer is intentionally invoked through the latest state below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.time, evaluated, task]);

  const correctValueAnswer = task.type === "value" ? parseResistance(valueAnswer) : Number.NaN;

  function evaluateAnswer(timedOut: boolean): Omit<Submission, "elapsed" | "timedOut"> {
    if (task.type === "value") {
      const enteredTolerance = settings.noTolerance ? 5 : Number(toleranceAnswer.replace(",", ".").replace("%", "").trim());
      const correct = Number.isFinite(correctValueAnswer)
        && Math.abs(correctValueAnswer - task.ohms) < Math.max(1e-10, task.ohms * 1e-8)
        && (settings.noTolerance || (Number.isFinite(enteredTolerance) && Math.abs(enteredTolerance - task.tolerance) < 1e-8));
      return {
        correct,
        response: settings.noTolerance ? valueAnswer.trim() || (timedOut ? "—" : "") : `${valueAnswer.trim() || "—"} ±${toleranceAnswer.trim() || "—"}%`,
      };
    }
    const requiredBands = settings.noTolerance ? 3 : 4;
    const correct = answers.slice(0, requiredBands).every((answer, band) => Number(answer) === Number(task.colors[band]));
    const response = answers.slice(0, requiredBands).map((value, band) => {
      if (value === null) return "—";
      return (band === 3 ? toleranceByValue(Number(value)) : colorByValue(Number(value)))?.name ?? "—";
    }).join(" · ");
    return { correct, response };
  }

  function submit(timedOut = false) {
    if (evaluated) return;
    setPicker(null);
    if (!timedOut && task.type === "value") {
      const missingValue = !valueAnswer.trim();
      const missingTolerance = !settings.noTolerance && !toleranceAnswer.trim();
      if (missingValue || missingTolerance) {
        setMissingInputs(true);
        setNotice(missingValue && missingTolerance ? "Enter a resistance and tolerance before checking." : missingValue ? "Enter a resistance before checking." : "Enter a tolerance before checking.");
        (missingValue ? valueInputRef.current : document.getElementById("toleranceAnswer"))?.focus();
        return;
      }
    }
    if (!timedOut && task.type === "code") {
      const requiredBands = settings.noTolerance ? 3 : 4;
      const missing = answers.slice(0, requiredBands).flatMap((answer, band) => answer === null ? [band] : []);
      if (missing.length) {
        setMissingBands(missing);
        setNotice("Choose a color for each band before checking.");
        document.querySelector<SVGGElement>(`.band-hit[data-band="${missing[0]}"]`)?.focus();
        return;
      }
    }
    const elapsed = (performance.now() - startedAtRef.current) / 1000;
    onEvaluate({ ...evaluateAnswer(timedOut), elapsed, timedOut });
  }
  submitRef.current = submit;

  function handleExerciseKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" || event.defaultPrevented || picker) return;
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

  function openPicker(band: number, element: SVGGElement) {
    const rect = element.getBoundingClientRect();
    setPicker({
      band,
      x: Math.min(window.innerWidth - 125, Math.max(125, rect.left + rect.width / 2)),
      y: Math.min(window.innerHeight - 125, Math.max(125, rect.top + rect.height / 2)),
    });
  }

  function chooseColor(value: number) {
    if (!picker) return;
    const nextAnswers = [...answers];
    nextAnswers[picker.band] = value;
    setAnswers(nextAnswers);
    setMissingBands((current) => current.filter((band) => band !== picker.band));
    setNotice("");
    setPicker(null);
    requestAnimationFrame(() => {
      const requiredBands = settings.noTolerance ? 3 : 4;
      const nextEmpty = nextAnswers.slice(0, requiredBands).findIndex((answer) => answer === null);
      if (nextEmpty >= 0) document.querySelector<SVGGElement>(`.band-hit[data-band="${nextEmpty}"]`)?.focus();
      else document.querySelector<HTMLButtonElement>(".submit-row button")?.focus();
    });
  }

  const feedbackText = evaluated
    ? task.timedOut ? "Time is up." : task.correct ? "Correct — nicely done." : "Not quite."
    : "";
  const expectedValue = `${formatOhms(task.ohms)}${settings.noTolerance ? "" : ` ±${task.tolerance}%`}`;
  const lastQuestion = !continuous && index === total - 1;
  const timerClass = secondsLeft <= 5 ? "timer warning" : "timer";

  return (
    <div onKeyDown={handleExerciseKeyDown}>
      <div className="stage-top">
        <div className="stage-title"><div className="eyebrow">{settings.mode === "mixed" ? "Mixed practice" : settings.mode === "value" ? "Value by code" : "Code by value"}</div><h1>Question {index + 1}</h1></div>
        <div className="progress-box">
          <div className="progress-label">{index + 1} {continuous ? "in continuous practice" : `of ${total}`}</div>
          <div className="progress-track"><div className="progress-fill" style={{ width: continuous ? "100%" : `${((index + 1) / total) * 100}%` }}/></div>
          <Button variant="quiet" className="end-early-button" type="button" onClick={onEnd}>End early</Button>
        </div>
      </div>
      <Card className="exercise-card">
        <div className="exercise-head"><div><div className="eyebrow">{task.type === "value" ? "Decode the resistor" : "Build the color code"}</div><h2>{task.type === "value" ? "What is the resistance?" : settings.noTolerance ? "Select the first three colors" : "Select the four band colors"}</h2></div>
          {settings.time > 0 && !evaluated && <div className={timerClass} aria-live="off">{Math.ceil(secondsLeft)}s</div>}
        </div>
        {task.type === "code" && <><div className="prompt-value">{formatOhms(task.ohms)}</div><div className="prompt-tolerance">Tolerance ±{settings.noTolerance ? 5 : task.tolerance}%</div></>}
        <div className="resistor-scene">
          <ResistorDiagram task={task} noTolerance={settings.noTolerance} answers={answers} missingBands={missingBands} disabled={evaluated}
            onSelectBand={openPicker}
            onBandKeyDown={(event, band) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                const bands = Array.from(document.querySelectorAll<SVGGElement>(".band-hit[tabindex='0']"));
                const currentIndex = bands.findIndex((element) => Number(element.dataset.band) === band);
                const offset = event.key === "ArrowRight" ? 1 : -1;
                bands[Math.max(0, Math.min(bands.length - 1, currentIndex + offset))]?.focus();
                return;
              }
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                const target = event.currentTarget;
                openPicker(band, target);
              }
            }}/>
        </div>
        <p className="resistor-caption">{task.type === "value" ? "Read the bands from left to right" : settings.noTolerance ? "Choose the first three colors; the gold 5% band is fixed" : "Click a band, then choose its color from the radial palette"}</p>
        {task.type === "value" && <div className="answer-row">
          <div className="answer-field"><label htmlFor="valueAnswer">Resistance</label><input ref={valueInputRef} className={`answer-input${missingInputs && !valueAnswer.trim() ? " invalid" : ""}`} id="valueAnswer" value={valueAnswer} onChange={(event) => { setValueAnswer(event.currentTarget.value); setMissingInputs(false); setNotice(""); }} onKeyDown={(event) => {
            if (event.key === "Enter") { event.preventDefault(); evaluated ? onNext() : submit(); }
            if (event.key === "Tab" && !event.shiftKey && !settings.noTolerance) { event.preventDefault(); document.getElementById("toleranceAnswer")?.focus(); }
          }} type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 4.7 kΩ" aria-label="Resistance value"/></div>
          <div className="answer-field"><label htmlFor="toleranceAnswer">Tolerance (%)</label><input className={`answer-input${missingInputs && !settings.noTolerance && !toleranceAnswer.trim() ? " invalid" : ""}`} id="toleranceAnswer" value={settings.noTolerance ? "5" : toleranceAnswer} onChange={(event) => { setToleranceAnswer(event.currentTarget.value); setMissingInputs(false); setNotice(""); }} onKeyDown={(event) => {
            if (event.key === "Enter") { event.preventDefault(); evaluated ? onNext() : submit(); }
            if (event.key === "Tab" && event.shiftKey) { event.preventDefault(); valueInputRef.current?.focus(); }
          }} type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 5" aria-label={settings.noTolerance ? "Fixed tolerance of 5 percent" : "Tolerance in percent"} readOnly={settings.noTolerance}/></div>
        </div>}
        {task.type === "value" && <p className="unit-hint answer-hint">Use a dot or comma for decimals. Prefixes: k, M, G, m, u/µ, n.</p>}
        {(notice || evaluated) && <div className={`feedback show ${evaluated ? task.correct ? "correct" : "incorrect" : "incorrect"}`} role="status">
          {evaluated ? <>
            <strong>{feedbackText}</strong>
            {task.correct ? `Answer: ${expectedValue}` : task.type === "value" ? `Correct answer: ${expectedValue}` : <><span>Correct band colors:</span><ColorDots task={task} noTolerance={settings.noTolerance}/></>}
          </> : notice}
        </div>}
        <div className="submit-row">{evaluated
          ? <Button type="button" onClick={onNext}>{lastQuestion ? "Check results" : "Next"}</Button>
          : <Button type="button" onClick={() => submit()}>{task.type === "value" ? "Check answer" : "Check colors"}</Button>}
        </div>
      </Card>
      {continuous && <Card className="graph-card"><div className="graph-heading"><strong>Recent practice</strong><span>Time left · uniform scale · incorrect answers are 0 · last 20 questions</span></div><LiveGraph tasks={recentTasks}/></Card>}
      {picker && <RadialPicker band={picker.band} position={{ x: picker.x, y: picker.y }} onPick={chooseColor} onClose={() => setPicker(null)}/>}
    </div>
  );
}
