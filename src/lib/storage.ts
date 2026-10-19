import type { Round } from "../types";

const STORAGE_KEY = "fourBandTrainer.v1";

export function readRounds(): Round[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (!stored || typeof stored !== "object" || !("rounds" in stored) || !Array.isArray(stored.rounds)) return [];
    const rounds = stored.rounds as Round[];
    rounds.forEach((round) => round.tasks?.forEach((task) => {
      const toleranceColor = task.colors?.[3];
      if (typeof toleranceColor === "string") {
        const color = ["Brown", "Red", "Green", "Blue", "Violet", "Grey", "Gold", "Silver"]
          .find((name) => name === toleranceColor);
        const tolerances: Record<string, number> = { Brown: 1, Red: 2, Green: 0.5, Blue: 0.25, Violet: 0.1, Grey: 0.05, Gold: 5, Silver: 10 };
        if (color) task.colors[3] = tolerances[color];
      }
    }));
    return rounds;
  } catch (error) {
    console.warn("Could not read saved practice history.", error);
    return [];
  }
}

export function writeRounds(rounds: Round[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rounds: rounds.slice(0, 100) }));
    return true;
  } catch (error) {
    console.warn("Could not save practice history.", error);
    return false;
  }
}
