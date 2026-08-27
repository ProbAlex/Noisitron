/** Maps a physical key (KeyboardEvent.code, layout-independent) to the key name
 *  Electron's accelerator strings expect. */
const CODE_TO_KEY: Record<string, string> = {
  Digit0: '0', Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4',
  Digit5: '5', Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9',
  KeyA: 'A', KeyB: 'B', KeyC: 'C', KeyD: 'D', KeyE: 'E', KeyF: 'F', KeyG: 'G',
  KeyH: 'H', KeyI: 'I', KeyJ: 'J', KeyK: 'K', KeyL: 'L', KeyM: 'M', KeyN: 'N',
  KeyO: 'O', KeyP: 'P', KeyQ: 'Q', KeyR: 'R', KeyS: 'S', KeyT: 'T', KeyU: 'U',
  KeyV: 'V', KeyW: 'W', KeyX: 'X', KeyY: 'Y', KeyZ: 'Z',
  F1: 'F1', F2: 'F2', F3: 'F3', F4: 'F4', F5: 'F5', F6: 'F6', F7: 'F7', F8: 'F8',
  F9: 'F9', F10: 'F10', F11: 'F11', F12: 'F12', F13: 'F13', F14: 'F14', F15: 'F15',
  F16: 'F16', F17: 'F17', F18: 'F18', F19: 'F19', F20: 'F20', F21: 'F21', F22: 'F22',
  F23: 'F23', F24: 'F24',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Space: 'Space', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete', Insert: 'Insert',
  Enter: 'Return', NumpadEnter: 'Return',
  Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown', Escape: 'Escape',
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backquote: '`',
  Numpad0: 'num0', Numpad1: 'num1', Numpad2: 'num2', Numpad3: 'num3', Numpad4: 'num4',
  Numpad5: 'num5', Numpad6: 'num6', Numpad7: 'num7', Numpad8: 'num8', Numpad9: 'num9',
  NumpadAdd: 'numadd', NumpadSubtract: 'numsub', NumpadMultiply: 'nummult',
  NumpadDivide: 'numdiv', NumpadDecimal: 'numdec',
  PrintScreen: 'PrintScreen',
  AudioVolumeUp: 'VolumeUp', AudioVolumeDown: 'VolumeDown', AudioVolumeMute: 'VolumeMute',
  MediaTrackNext: 'MediaNextTrack', MediaTrackPrevious: 'MediaPreviousTrack',
  MediaStop: 'MediaStop', MediaPlayPause: 'MediaPlayPause'
}

const MODIFIER_CODES = new Set([
  'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight',
  'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight'
])

export interface AcceleratorAttempt {
  /** Non-null only when a usable combination was captured. */
  accelerator: string | null
  /** Set when the keypress couldn't become an accelerator (still shown to the user). */
  error: string | null
}

/** Still waiting on a non-modifier key. */
export function isModifierOnly(e: KeyboardEvent): boolean {
  return MODIFIER_CODES.has(e.code)
}

export function buildAccelerator(e: KeyboardEvent): AcceleratorAttempt {
  const mainKey = CODE_TO_KEY[e.code]
  if (!mainKey) {
    return { accelerator: null, error: `"${e.code}" can't be used in a shortcut.` }
  }

  const modifiers: string[] = []
  if (e.ctrlKey) modifiers.push('Control')
  if (e.altKey) modifiers.push('Alt')
  if (e.shiftKey) modifiers.push('Shift')
  if (e.metaKey) modifiers.push('Super')

  if (modifiers.length === 0) {
    return { accelerator: null, error: 'Include at least one modifier key (Ctrl, Alt, Shift, or Super).' }
  }

  return { accelerator: [...modifiers, mainKey].join('+'), error: null }
}

/** "Control+Alt+F1" -> "Ctrl + Alt + F1" */
export function formatAccelerator(accelerator: string): string {
  return accelerator
    .split('+')
    .map((part) => (part === 'Control' ? 'Ctrl' : part))
    .join(' + ')
}
