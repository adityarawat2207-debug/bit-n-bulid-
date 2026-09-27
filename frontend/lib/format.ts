export const usd = (n: number) =>
  (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");

export const pct = (n: number, digits = 1) => `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;

export const pp = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}pp`;

export const time = (iso: string) => `${iso.slice(5, 10)} ${iso.slice(11, 16)}`;

export const hourLabel = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} ${iso.slice(11, 16)}`;
};

export const confidence = (n: number) => `${Math.round(n * 100)}%`;

export const changeColor = (n: number) =>
  n > 5 ? "text-alert" : n < -5 ? "text-ok" : "text-muted";
