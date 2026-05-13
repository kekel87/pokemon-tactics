export const Weather = {
  None: "none",
  Sun: "sun",
  Rain: "rain",
  Sandstorm: "sandstorm",
  Snow: "snow",
} as const;

export type Weather = (typeof Weather)[keyof typeof Weather];
