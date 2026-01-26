// Standard VexFlow notation codes
export type NoteDuration = 'w' | 'h' | 'q' | '8' | '16'; 

export interface RenderedNote {
  id: string;
  keys: string[];   // e.g. ["c/4", "e/4"]
  duration: NoteDuration;
  isRest: boolean;
  color?: string;   // "red" for active, "black" for committed
}