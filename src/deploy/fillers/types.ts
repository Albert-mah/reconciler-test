/**
 * Shared types for block filler modules.
 */

export type LogFn = (msg: string) => void;

export interface PopupContext {
  seenColls: Set<string>;  // circular reference detection (stops infinite popup chains)
}
