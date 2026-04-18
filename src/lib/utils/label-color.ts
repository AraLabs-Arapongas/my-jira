// Stable hue from a label string.
export function labelColor(label: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) | 0;
  }
  const hue = ((hash % 360) + 360) % 360;
  return {
    bg: `hsl(${hue} 70% 88%)`,
    fg: `hsl(${hue} 45% 28%)`,
  };
}
