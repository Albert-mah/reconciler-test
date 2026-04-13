/**
 * Shared types for block filler modules.
 */

export type LogFn = (msg: string) => void;

export interface PopupContext {
  refDepth: number;        // remaining reference-expansion budget (decrements on each ref expansion)
  seenColls: Set<string>;  // circular reference detection (stops infinite popup chains)
}
