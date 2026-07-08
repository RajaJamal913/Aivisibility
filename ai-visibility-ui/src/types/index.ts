// Mirrors the JSON shapes returned by the AI Visibility Intelligence API
// (Task 1 Flask backend). Keeping these in one file means every service
// call and component shares a single source of truth for the contract.

export type PipelineStatus = 'created' | 'running' | 'completed' | 'partial' | 'failed';
export type VisibilityStatus = 'visible' | 'not_visible' | 'unknown';
export type Priority = 'high' | 'medium' | 'low';
export type ContentType = 'blog_post' | 'landing_page' | 'faq' | 'comparison_page' | 'case_study';

export interface ProfileStats {
  total_queries_discovered: number;
  avg_opportunity_score: number | null;
  total_pipeline_runs: number;
  total_recommendations: number;
}

export interface BusinessProfile {
  profile_uuid: string;
  name: string;
  domain: string;
  industry: string;
  description: string | null;
  competitors: string[];
  status: string;
  created_at: string;
  updated_at: string;
  stats?: ProfileStats;
}

export interface DiscoveredQuery {
  query_uuid: string;
  profile_uuid: string;
  run_uuid: string;
  query_text: string;
  query_intent: string | null;
  estimated_search_volume: number | null;
  competitive_difficulty: number | null;
  opportunity_score: number | null;
  domain_visible: boolean | null;
  visibility_position: number | null;
  visibility_status: VisibilityStatus;
  // Agent 2's one-sentence judgment for why it scored visibility the way
  // it did -- real LLM output (or a labeled fallback string), not a
  // fabricated snippet.
  confidence_reasoning: string | null;
  // {competitor_domain: bool} -- Agent 2's per-competitor visibility
  // judgment for this same query. Backs the real Share of Voice chart;
  // see ShareOfVoiceEntity below for the aggregated view.
  competitor_visibility: Record<string, boolean>;
  // Which LLM actually scored this query -- real provider/model config,
  // surfaced in the mentions table as the Platform column.
  scoring_llm_provider: string | null;
  scoring_llm_model: string | null;
  scoring_error: string | null;
  discovered_at: string;
  last_scored_at: string | null;
}

export interface ContentRecommendation {
  recommendation_uuid: string;
  target_query_uuid: string;
  profile_uuid: string;
  content_type: ContentType;
  title: string;
  rationale: string;
  target_keywords: string[];
  priority: Priority;
  created_at: string;
}

export interface PipelineRunSummary {
  run_uuid: string;
  profile_uuid: string;
  status: PipelineStatus;
  queries_discovered: number;
  queries_scored: number;
  recommendations_generated: number;
  tokens_used: number | null;
  data_provider_used: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface PaginatedRuns {
  runs: PipelineRunSummary[];
  pagination: Pagination;
}

export interface PipelineRunResult extends PipelineRunSummary {
  top_opportunity_queries: DiscoveredQuery[];
  content_recommendations: ContentRecommendation[];
}

export interface Pagination {
  page: number;
  per_page: number;
  total_items: number;
  total_pages: number;
}

export interface PaginatedProfiles {
  profiles: BusinessProfile[];
  pagination: Pagination;
}

export interface PaginatedQueries {
  queries: DiscoveredQuery[];
  pagination: Pagination;
}

export interface RecommendationsResponse {
  recommendations: ContentRecommendation[];
}

// Real "you vs. each competitor" visibility comparison -- see
// BusinessProfile.share_of_voice() in the backend. share_pct is null only
// when the profile has zero discovered queries yet (not "0%", genuinely
// unknown).
export interface ShareOfVoiceEntity {
  name: string;
  is_you: boolean;
  visible_count: number;
  total_queries: number;
  share_pct: number | null;
}

export interface ShareOfVoiceResponse {
  entities: ShareOfVoiceEntity[];
}

export interface CreateProfileInput {
  name: string;
  domain: string;
  industry: string;
  description?: string;
  competitors?: string[];
}

export interface QueryFilters {
  min_score?: number;
  status?: VisibilityStatus;
  page?: number;
  per_page?: number;
}

export interface ApiErrorShape {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
