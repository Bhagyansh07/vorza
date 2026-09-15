export const HEALTH_MAX = 100;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function healthColor(health: number): string {
  const h = clamp(health, 0, HEALTH_MAX);
  let hue: number;
  if (h <= 50) {
    hue = lerp(4, 38, h / 50);
  } else {
    hue = lerp(38, 152, (h - 50) / 50);
  }
  return `hsl(${hue} 62% 56%)`;
}

export function healthFill(health: number): string {
  return healthColor(health);
}

export type HealthTone = "good" | "warn" | "bad";

export function healthTone(health: number): HealthTone {
  if (health >= 70) return "good";
  if (health >= 45) return "warn";
  return "bad";
}

export function healthLabel(health: number): string {
  if (health >= 70) return "Healthy";
  if (health >= 45) return "At risk";
  return "Critical";
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export interface RadiusSpec {
  min: number;
  max: number;
}

export const DEFAULT_RADIUS: RadiusSpec = { min: 3, max: 21 };

export function nodeRadius(
  complexity: number,
  loc: number,
  spec: RadiusSpec = DEFAULT_RADIUS,
): number {
  const value = Math.max(complexity, Math.sqrt(loc) * 0.55);
  const span = spec.max - spec.min;
  const root = Math.sqrt(value);
  const maxRoot = Math.sqrt(60);
  const scaled = clamp(root / maxRoot, 0, 1);
  return spec.min + span * scaled;
}

export interface LegendStop {
  health: number;
  color: string;
  label: string;
}

export function legendStops(): LegendStop[] {
  return [
    { health: 0, color: healthColor(0), label: "Critical" },
    { health: 25, color: healthColor(25), label: "" },
    { health: 50, color: healthColor(50), label: "At risk" },
    { health: 75, color: healthColor(75), label: "" },
    { health: 100, color: healthColor(100), label: "Healthy" },
  ];
}

export function radiusSamplePoints(): Array<{ complexity: number; radius: number }> {
  return [3, 12, 35, 90].map((c) => ({
    complexity: c,
    radius: nodeRadius(c, c * 8),
  }));
}