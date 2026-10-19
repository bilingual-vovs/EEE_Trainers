import type { ColorBand, ESeries, ResistorTask, Round, Settings, TaskType } from "../types";

export const COLORS: ColorBand[] = [
  { name: "Black", value: 0, hex: "#252522", text: "#fff" },
  { name: "Brown", value: 1, hex: "#795038", text: "#fff" },
  { name: "Red", value: 2, hex: "#c44738", text: "#fff" },
  { name: "Orange", value: 3, hex: "#e06b1b", text: "#28261f" },
  { name: "Yellow", value: 4, hex: "#f2c84b", text: "#28261f" },
  { name: "Green", value: 5, hex: "#64814a", text: "#fff" },
  { name: "Blue", value: 6, hex: "#477ba0", text: "#fff" },
  { name: "Violet", value: 7, hex: "#82649b", text: "#fff" },
  { name: "Grey", value: 8, hex: "#686d73", text: "#fff" },
  { name: "White", value: 9, hex: "#f7f4ed", text: "#28261f" },
  { name: "Gold", value: -1, hex: "#d4a017", text: "#28261f" },
  { name: "Silver", value: -2, hex: "#d5d9de", text: "#28261f" },
];

export const TOLERANCES: ColorBand[] = [
  { value: 1, name: "Brown", hex: "#795038", text: "#fff" },
  { value: 2, name: "Red", hex: "#c44738", text: "#fff" },
  { value: 0.5, name: "Green", hex: "#64814a", text: "#fff" },
  { value: 0.25, name: "Blue", hex: "#477ba0", text: "#fff" },
  { value: 0.1, name: "Violet", hex: "#82649b", text: "#fff" },
  { value: 0.05, name: "Grey", hex: "#686d73", text: "#fff" },
  { value: 5, name: "Gold", hex: "#d4a017", text: "#28261f" },
  { value: 10, name: "Silver", hex: "#d5d9de", text: "#28261f" },
];

const SERIES_COUNTS: Record<Exclude<ESeries, "none">, number> = {
  E3: 3,
  E6: 6,
  E12: 12,
  E24: 24,
  E48: 48,
  E96: 96,
  E192: 192,
};

const STANDARD_VALUES: Partial<Record<ESeries, number[]>> = {
  E3: [1, 2.2, 4.7],
  E6: [1, 1.5, 2.2, 3.3, 4.7, 6.8],
  E12: [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2],
  E24: [1, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2, 2.2, 2.4, 2.7, 3, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1],
};

export const SERIES_OPTIONS: ESeries[] = ["none", "E3", "E6", "E12", "E24", "E48", "E96", "E192"];

export function trim(value: number): string {
  return Number(value.toPrecision(4)).toString();
}

export function formatOhms(value: number): string {
  if (value >= 1e9) return `${trim(value / 1e9)} GΩ`;
  if (value >= 1e6) return `${trim(value / 1e6)} MΩ`;
  if (value >= 1e3) return `${trim(value / 1e3)} kΩ`;
  if (value < 1 && value >= 1e-3) return `${trim(value * 1e3)} mΩ`;
  if (value < 1e-3) return `${trim(value * 1e6)} µΩ`;
  return `${trim(value)} Ω`;
}

export function formatDuration(seconds: number): string {
  if (seconds >= 3600) return `${trim(seconds / 3600)} hr`;
  if (seconds >= 60) return `${Math.ceil(seconds / 60)} min`;
  return `${Math.ceil(seconds)} sec`;
}

export function colorByValue(value: number): ColorBand | undefined {
  return COLORS.find((color) => color.value === value);
}

export function toleranceByValue(value: number): ColorBand | undefined {
  return TOLERANCES.find((color) => color.value === value);
}

export function seriesDigits(series: ESeries): number[] {
  if (series === "none") return Array.from({ length: 90 }, (_, index) => index + 10);
  const count = SERIES_COUNTS[series];
  const values = STANDARD_VALUES[series] ?? Array.from(
    { length: count },
    (_, index) => Number(Math.pow(10, index / count).toPrecision(3)),
  );
  return [...new Set(values.map((value) => Math.round(value * 10)))];
}

export function parseResistance(input: string): number {
  const text = input.trim().replace(/Ω|ohms?/gi, "").replace(/\s+/g, "");
  const match = text.match(/^([+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+))(G|M|k|K|m|u|µ|μ|n)?$/);
  if (!match) return Number.NaN;
  const number = Number(match[1].replace(",", "."));
  const powers: Record<string, number> = { G: 9, M: 6, k: 3, K: 3, m: -3, u: -6, "µ": -6, "μ": -6, n: -9 };
  return number * Math.pow(10, match[2] ? powers[match[2]] : 0);
}

export function makeQuestion(type: TaskType, settings: Settings, value: { digits: number; multiplier: number }): ResistorTask {
  const first = Math.floor(value.digits / 10);
  const second = value.digits % 10;
  const tolerance = settings.noTolerance ? 5 : TOLERANCES[Math.floor(Math.random() * TOLERANCES.length)].value;
  return {
    type,
    digits: [first, second],
    multiplier: value.multiplier,
    tolerance,
    colors: [first, second, value.multiplier, tolerance],
    ohms: value.digits * Math.pow(10, value.multiplier),
    answers: type === "code" ? [null, null, null, settings.noTolerance ? 5 : null] : [],
    correct: false,
    elapsed: 0,
    timedOut: false,
  };
}

export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function modeLabel(mode: string): string {
  return ({ value: "Value by code", code: "Code by value", mixed: "Mixed practice" } as Record<string, string>)[mode] ?? mode;
}

export function taskColors(task: ResistorTask, noTolerance: boolean): ColorBand[] {
  return task.colors.slice(0, noTolerance ? 3 : 4).map((value, index) => {
    const color = index === 3 ? toleranceByValue(value) : colorByValue(value);
    return color ?? COLORS[0];
  });
}

export function roundAverage(rounds: Round[]): number {
  const count = rounds.reduce((total, round) => total + round.total, 0);
  return count ? rounds.reduce((sum, round) => sum + round.average * round.total, 0) / count : 0;
}
