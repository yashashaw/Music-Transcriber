export type NoteDuration = '1' | '2' | '4' | '8' | '16';
export type DrumType = 'bd' | 'sn' | 'hhc' | 'hho' | 'cymc' | 'cymr'; //lilypond notation

export interface RenderedNote {
  id: string;
  types: DrumType[]; // array to handle chords
  duration: NoteDuration;
  isRest: boolean;
}