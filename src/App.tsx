import { useRef, useState } from "react";
import type { ResistorTask, Round, Settings, TaskType } from "./types";
import { makeQuestion, seriesDigits, shuffle } from "./lib/resistors";
import { readRounds, writeRounds } from "./lib/storage";
import { HistoryDialog, Header, Footer } from "./components/Shared";
import { SetupScreen } from "./components/SetupScreen";
import { PracticeScreen } from "./components/PracticeScreen";
import { ResultsScreen } from "./components/ResultsScreen";

const EMPTY_SETTINGS: Settings = { rolls: 10, time: 0, mode: "mixed", series: "none", noTolerance: false };

function createQuestionGenerator(settings: Settings) {
  const valueDeck = shuffle(seriesDigits(settings.series).flatMap((digits) =>
    Array.from({ length: 12 }, (_, index) => ({ digits, multiplier: index - 2 })),
  ));
  let valueIndex = 0;
  let lastType: TaskType | null = null;
  let clusterType: TaskType | null = null;
  let clusterLeft = 0;
  let created = 0;

  return (target: number, forcedType?: TaskType): ResistorTask => {
    let type: TaskType;
    if (forcedType) type = forcedType;
    else if (settings.mode !== "mixed") type = settings.mode;
    else {
      if (clusterLeft <= 0) {
        type = lastType === null || lastType === "code" ? (Math.random() < 0.5 ? "value" : "code") : "code";
        if (type === lastType) type = type === "code" ? "value" : "code";
        clusterType = type;
        lastType = type;
        const remaining = target === Infinity ? Infinity : target - created;
        let clusterSize = Math.min(remaining, 2 + Math.floor(Math.random() * 3));
        if (remaining - clusterSize === 1) clusterSize += clusterSize < 4 ? 1 : -1;
        clusterLeft = clusterSize;
      }
      type = clusterType ?? "value";
      clusterLeft--;
    }
    const value = valueDeck[valueIndex % valueDeck.length];
    valueIndex++;
    created++;
    return makeQuestion(type, settings, value);
  };
}

export default function App() {
  const [screen, setScreen] = useState<"setup" | "practice" | "results">("setup");
  const [rounds, setRounds] = useState<Round[]>(() => readRounds());
  const [settings, setSettings] = useState<Settings>(EMPTY_SETTINGS);
  const [tasks, setTasks] = useState<ResistorTask[]>([]);
  const [index, setIndex] = useState(0);
  const [roundResult, setRoundResult] = useState<Round | null>(null);
  const [correction, setCorrection] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [toast, setToast] = useState("");
  const generatorRef = useRef<((target: number, forcedType?: TaskType) => ResistorTask) | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const task = tasks[index];

  function showToast(message: string) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2400);
  }

  function saveRound(round: Round) {
    const nextRounds = [round, ...rounds].slice(0, 100);
    setRounds(nextRounds);
    if (!writeRounds(nextRounds)) showToast("History could not be saved on this device.");
  }

  function beginRound(nextSettings: Settings, correctionTasks?: ResistorTask[]) {
    setSettings(nextSettings);
    setCorrection(Boolean(correctionTasks));
    setRoundResult(null);
    setIndex(0);
    if (correctionTasks?.length) {
      generatorRef.current = null;
      setTasks(correctionTasks.map((missed) => ({
        ...missed,
        answers: missed.type === "code" ? [null, null, null, nextSettings.noTolerance ? 5 : null] : [],
        correct: false,
        elapsed: 0,
        timedOut: false,
        response: undefined,
      })));
    } else {
      const generator = createQuestionGenerator(nextSettings);
      generatorRef.current = generator;
      setTasks([generator(nextSettings.rolls)]);
    }
    setScreen("practice");
  }

  function evaluateCurrent(result: Pick<ResistorTask, "correct" | "elapsed" | "timedOut" | "response">) {
    setTasks((current) => current.map((item, taskIndex) => taskIndex === index ? { ...item, ...result } : item));
  }

  function finishRound(completedTasks = tasks) {
    const completed = completedTasks.filter((item) => item.response !== undefined);
    const correct = completed.filter((item) => item.correct).length;
    const average = completed.length ? completed.reduce((sum, item) => sum + item.elapsed, 0) / completed.length : 0;
    const result: Round = {
      id: Date.now(),
      date: new Date().toISOString(),
      mode: correction ? "Error correction" : settings.mode,
      series: settings.series,
      noTolerance: settings.noTolerance,
      total: completed.length,
      correct,
      average,
      tasks: completed,
    };
    setRoundResult(result);
    setScreen("results");
    saveRound(result);
  }

  function nextQuestion() {
    if (!task?.response) return;
    const nextIndex = index + 1;
    const target = correction ? tasks.length : settings.rolls;
    if (target !== Infinity && nextIndex >= target) {
      finishRound(tasks);
      return;
    }
    const nextTask = generatorRef.current?.(target) ?? task;
    setTasks((current) => [...current.slice(0, nextIndex), nextTask]);
    setIndex(nextIndex);
  }

  function repeatRound() {
    setCorrection(false);
    beginRound(settings);
  }

  function practiceErrors() {
    if (!roundResult) return;
    const missed = roundResult.tasks.filter((item) => !item.correct);
    if (!missed.length) return;
    beginRound({ ...settings, rolls: missed.length, mode: "mixed" }, missed);
  }

  function clearHistory() {
    if (!window.confirm("Clear all saved practice history from this device?")) return;
    setRounds([]);
    if (!writeRounds([])) showToast("History could not be cleared from this device.");
  }

  return (
    <div className="shell">
      <Header onHome={() => { setHistoryOpen(false); setScreen("setup"); }} onHistory={() => setHistoryOpen(true)}/>
      <main id="app" aria-live="polite">
        {screen === "setup" && <SetupScreen rounds={rounds} onStart={(nextSettings) => beginRound(nextSettings)}/>}
        {screen === "practice" && task && <PracticeScreen key={index} task={task} index={index} total={settings.rolls} continuous={settings.rolls === Infinity} settings={settings} recentTasks={tasks.filter((item) => item.response !== undefined)} onEvaluate={evaluateCurrent} onNext={nextQuestion} onEnd={() => finishRound(tasks)}/>}
        {screen === "results" && roundResult && <ResultsScreen round={roundResult} correction={correction} onHome={() => setScreen("setup")} onRepeat={repeatRound} onCorrectErrors={practiceErrors} onHistory={() => setHistoryOpen(true)}/>}
      </main>
      <Footer/>
      <HistoryDialog open={historyOpen} rounds={rounds} onClose={() => setHistoryOpen(false)} onClear={clearHistory}/>
      <div className={`toast${toast ? " show" : ""}`} role="status">{toast}</div>
    </div>
  );
}
