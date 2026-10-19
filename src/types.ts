export type ExerciseMode = "value" | "code" | "mixed";
export type TaskType = Exclude<ExerciseMode, "mixed">;
export type ESeries = "none" | "E3" | "E6" | "E12" | "E24" | "E48" | "E96" | "E192";
export type Screen = "setup" | "practice" | "results";

export interface Settings {
  rolls: number;
  time: number;
  mode: ExerciseMode;
  series: ESeries;
  noTolerance: boolean;
}

export interface ResistorTask {
  type: TaskType;
  digits: [number, number];
  multiplier: number;
  tolerance: number;
  colors: [number, number, number, number];
  ohms: number;
  answers: Array<number | null>;
  correct: boolean;
  elapsed: number;
  timedOut: boolean;
  response?: string;
}

export interface Round {
  id: number;
  date: string;
  mode: ExerciseMode | "Error correction";
  series: ESeries;
  noTolerance: boolean;
  total: number;
  correct: number;
  average: number;
  tasks: ResistorTask[];
}

export interface ColorBand {
  name: string;
  value: number;
  hex: string;
  text: string;
}
