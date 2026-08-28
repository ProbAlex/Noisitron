import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { EMOJI_CATEGORIES, searchEmojis } from '../data/emoji'

const PICKER_WIDTH = 344
const PICKER_HEIGHT = 380

interface EmojiPickerProps {
  value: string | null
  anchorX: number
  anchorY: number
  onSelect: (emoji: string) => void
  onClose: () => void
}

export function EmojiPicker({ value, anchorX, anchorY, onSelect, onClose }: EmojiPickerProps) {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState(0)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useLayoutEffect(() => {
    const margin = 8
    const left = Math.min(Math.max(margin, anchorX), window.innerWidth - PICKER_WIDTH - margin)
    const top = Math.min(Math.max(margin, anchorY), window.innerHeight - PICKER_HEIGHT - margin)
    setPos({ left, top })
  }, [anchorX, anchorY])

  useEffect(() => {
    // Capture phase: guarantees this closes just the picker (not the sound edit menu
    // underneath, which has its own bubble-phase Escape handler) regardless of mount order.
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  const results = query.trim() ? searchEmojis(query) : null
  const shown = results ?? EMOJI_CATEGORIES[activeCategory].emojis

  return (
    <div className="fixed inset-0 z-[60]" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={
          pos
            ? { left: pos.left, top: pos.top, width: PICKER_WIDTH, height: PICKER_HEIGHT }
            : { left: anchorX, top: anchorY, width: PICKER_WIDTH, height: PICKER_HEIGHT, visibility: 'hidden' }
        }
        className="fixed z-[61] flex flex-col overflow-hidden rounded-2xl border border-base-700 bg-base-850 shadow-2xl shadow-black/50 animate-pop-in"
      >
        <div className="border-b border-base-700 p-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">
              🔍
            </span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search emoji…"
              className="w-full rounded-lg border border-base-600 bg-base-950 py-1.5 pl-7 pr-3 text-sm text-slate-100 outline-none focus:border-accent"
            />
          </div>
        </div>

        {!query.trim() && (
          <div className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-base-700 px-1.5 py-1.5">
            {EMOJI_CATEGORIES.map((cat, i) => (
              <button
                key={cat.label}
                title={cat.label}
                onClick={() => setActiveCategory(i)}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-base transition-colors ${
                  activeCategory === i ? 'bg-accent-soft ring-1 ring-accent' : 'hover:bg-base-700'
                }`}
              >
                {cat.icon}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2">
          {shown.length === 0 ? (
            <p className="pt-8 text-center text-xs text-slate-500">No emoji found</p>
          ) : (
            <div className="grid grid-cols-8 gap-1">
              {shown.map((e) => (
                <button
                  key={e.emoji}
                  title={e.name}
                  onClick={() => {
                    onSelect(e.emoji)
                    onClose()
                  }}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-transform hover:scale-110 hover:bg-base-700 ${
                    value === e.emoji ? 'bg-accent-soft ring-1 ring-accent' : ''
                  }`}
                >
                  {e.emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
