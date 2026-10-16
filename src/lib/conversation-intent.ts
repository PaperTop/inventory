// Match entire conversational utterances, never substrings of item names.
export function conversationIntent(question: string) {
  const text = question
    .trim()
    .replace(/[.!?,]+$/g, "")
    .trim();
  if (
    /^(?:hi|hello|hey|hiya|howdy|good (?:morning|afternoon|evening))(?: there| jarvis)?$/i.test(
      text,
    )
  )
    return "Hi! I can help you find items, check a location, plan packing, or add and edit inventory. What would you like to do?";
  if (
    /^(?:thanks|thank you|thank you so much|thanks a lot|cheers)(?: jarvis)?$/i.test(
      text,
    )
  )
    return "You're welcome! Let me know if you'd like to find something or work on your inventory.";
  if (
    /^(?:help|help me|what can you do|how can you help(?: me)?|what do you do|how do I use (?:this|jarvis))$/i.test(
      text,
    )
  )
    return "I can find your items, show everything in a location, help plan a packing list, or prepare explicit inventory edits when AI is enabled. Try “Where is my camera?” or “Pack me for camping”.";
  if (/^(?:how are you|how's it going|what's up|sup)$/i.test(text))
    return "I'm ready to help with your inventory. What would you like to find or plan?";
  if (/^(?:bye|goodbye|see you|see you later)$/i.test(text))
    return "See you! Your inventory will be here when you need it.";
  return null;
}

export function withoutGreeting(question: string) {
  return question.replace(
    /^(?:hi|hello|hey)(?:[!,.:;]\s*|\s+)(?=(?:where|what|which|show|find|can|do|i|help|pack|plan|add|rename|edit|update|remove)\b)/i,
    "",
  );
}
