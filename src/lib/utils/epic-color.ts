export type EpicColor =
  | "purple"
  | "blue"
  | "green"
  | "yellow"
  | "orange"
  | "red"
  | "teal"
  | "gray";

export const EPIC_COLORS: readonly EpicColor[] = [
  "purple",
  "blue",
  "green",
  "yellow",
  "orange",
  "red",
  "teal",
  "gray",
] as const;

export const epicPalette: Record<
  EpicColor,
  { border: string; bg: string; chipBg: string; chipFg: string; dot: string }
> = {
  purple: { border: "#6554C0", bg: "#F3F0FF", chipBg: "#EAE6FF", chipFg: "#403294", dot: "#6554C0" },
  blue:   { border: "#0052CC", bg: "#EAF2FF", chipBg: "#DEEBFF", chipFg: "#0747A6", dot: "#0052CC" },
  green:  { border: "#00875A", bg: "#ECFDF3", chipBg: "#E3FCEF", chipFg: "#006644", dot: "#00875A" },
  yellow: { border: "#E09400", bg: "#FFF9E6", chipBg: "#FFF0B3", chipFg: "#7F5F01", dot: "#FFAB00" },
  orange: { border: "#FF8B00", bg: "#FFF4E5", chipBg: "#FFE2BD", chipFg: "#974F00", dot: "#FF8B00" },
  red:    { border: "#DE350B", bg: "#FFF1EF", chipBg: "#FFEBE6", chipFg: "#BF2600", dot: "#DE350B" },
  teal:   { border: "#00A3BF", bg: "#E6FCFF", chipBg: "#B3F5FF", chipFg: "#008DA6", dot: "#00A3BF" },
  gray:   { border: "#5E6C84", bg: "#F4F5F7", chipBg: "#DFE1E6", chipFg: "#42526E", dot: "#5E6C84" },
};

export function epicTone(color: string) {
  return epicPalette[(EPIC_COLORS as readonly string[]).includes(color) ? (color as EpicColor) : "purple"];
}
