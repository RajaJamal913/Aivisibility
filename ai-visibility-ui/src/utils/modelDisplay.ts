// Real model identifiers (as stored in DiscoveredQuery.scoring_llm_model,
// e.g. "claude-sonnet-4-6", "gpt-4o") mapped to display-friendly labels.
// Shared by RecentMentionsTable (Platform column) and the Dashboard's
// "AI Engine" filter so both surfaces agree on the same names -- this is
// real per-query data (which LLM actually scored that query), not a
// fabricated per-query "AI engine" concept.
export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'claude-opus-4-6': 'Claude Opus 4.6',
  'claude-haiku-4-6': 'Claude Haiku 4.6',
  'gpt-4o': 'ChatGPT (GPT-4o)',
  'gpt-4o-mini': 'ChatGPT (GPT-4o mini)',
  'grok-4.1-fast': 'Grok 4.1 Fast',
  'grok-4.3': 'Grok 4.3',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
};

export function formatModelName(model: string | null | undefined): string {
  if (!model) return '—';
  return MODEL_DISPLAY_NAMES[model] ?? model;
}
