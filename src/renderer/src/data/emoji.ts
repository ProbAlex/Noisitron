import emojiGroups from 'unicode-emoji-json/data-by-group.json'

export interface EmojiEntry {
  emoji: string
  name: string
}

export interface EmojiCategory {
  label: string
  icon: string
  emojis: EmojiEntry[]
}

const CATEGORY_ICONS: Record<string, string> = {
  'Smileys & Emotion': '😀',
  'People & Body': '🧑',
  'Animals & Nature': '🐶',
  'Food & Drink': '🍔',
  'Travel & Places': '🌍',
  Activities: '⚽',
  Objects: '💡',
  Symbols: '❤️',
  Flags: '🏳️'
}

export const EMOJI_CATEGORIES: EmojiCategory[] = Object.values(emojiGroups).map((group) => ({
  label: group.name,
  icon: CATEGORY_ICONS[group.name] ?? group.emojis[0]?.emoji ?? '❔',
  emojis: group.emojis.map((e) => ({ emoji: e.emoji, name: e.name }))
}))

const ALL_EMOJIS: EmojiEntry[] = EMOJI_CATEGORIES.flatMap((c) => c.emojis)

export function searchEmojis(query: string, limit = 120): EmojiEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const results: EmojiEntry[] = []
  for (const entry of ALL_EMOJIS) {
    if (entry.name.toLowerCase().includes(q)) {
      results.push(entry)
      if (results.length >= limit) break
    }
  }
  return results
}
