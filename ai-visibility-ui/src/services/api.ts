import axios, { AxiosError } from 'axios';
import type {
  BusinessProfile,
  CreateProfileInput,
  PaginatedProfiles,
  PaginatedQueries,
  PaginatedRuns,
  PipelineRunResult,
  QueryFilters,
  RecommendationsResponse,
  ShareOfVoiceResponse,
  ApiErrorShape,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Normalizes every failure -- network errors, timeouts, and structured
 * {error: {code, message}} responses from the Flask backend -- into a
 * single Error with a human-readable message. Components never need to
 * know whether a failure was a network drop or a 422 validation error;
 * they just render `error.message`.
 */
export class ApiError extends Error {
  code: string;
  details?: Record<string, unknown>;

  constructor(message: string, code = 'UNKNOWN_ERROR', details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function normalizeError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    const axiosErr = err as AxiosError<ApiErrorShape>;
    if (axiosErr.response?.data?.error) {
      const { code, message, details } = axiosErr.response.data.error;
      return new ApiError(message, code, details);
    }
    if (axiosErr.code === 'ECONNABORTED') {
      return new ApiError('The request took too long to respond. Please try again.', 'TIMEOUT');
    }
    if (!axiosErr.response) {
      return new ApiError(
        `Could not reach the API at ${API_BASE_URL}. Confirm the backend is running.`,
        'NETWORK_ERROR'
      );
    }
    return new ApiError(`Request failed with status ${axiosErr.response.status}.`, 'HTTP_ERROR');
  }
  return new ApiError('An unexpected error occurred.', 'UNKNOWN_ERROR');
}

async function request<T>(fn: () => Promise<{ data: T }>): Promise<T> {
  try {
    const res = await fn();
    return res.data;
  } catch (err) {
    throw normalizeError(err);
  }
}

// ---- Profiles ----

export function listProfiles(page = 1, perPage = 20): Promise<PaginatedProfiles> {
  return request(() => client.get('/api/v1/profiles', { params: { page, per_page: perPage } }));
}

export function getProfile(profileUuid: string): Promise<BusinessProfile> {
  return request(() => client.get(`/api/v1/profiles/${profileUuid}`));
}

export function createProfile(input: CreateProfileInput): Promise<BusinessProfile> {
  return request(() => client.post('/api/v1/profiles', input));
}

// ---- Pipeline ----

export function runPipeline(profileUuid: string): Promise<PipelineRunResult> {
  // The pipeline is synchronous server-side and can take 10-30s+ (longer
  // on rate-limited free-tier LLM keys), so this call intentionally has a
  // much longer timeout than the client default.
  return request(() =>
    client.post(`/api/v1/profiles/${profileUuid}/run`, null, { timeout: 5 * 60 * 1000 })
  );
}

// ---- Queries ----

export function listQueries(profileUuid: string, filters: QueryFilters = {}): Promise<PaginatedQueries> {
  return request(() =>
    client.get(`/api/v1/profiles/${profileUuid}/queries`, {
      params: {
        min_score: filters.min_score,
        status: filters.status,
        page: filters.page ?? 1,
        per_page: filters.per_page ?? 20,
      },
    })
  );
}

export function recheckQuery(queryUuid: string): Promise<{ query: PaginatedQueries['queries'][number]; tokens_used: number | null }> {
  return request(() => client.post(`/api/v1/queries/${queryUuid}/recheck`));
}

// ---- Recommendations ----

export function listRecommendations(profileUuid: string): Promise<RecommendationsResponse> {
  return request(() => client.get(`/api/v1/profiles/${profileUuid}/recommendations`));
}

// ---- Pipeline Run History ----

export function listPipelineRuns(profileUuid: string, page = 1, perPage = 20): Promise<PaginatedRuns> {
  return request(() =>
    client.get(`/api/v1/profiles/${profileUuid}/runs`, { params: { page, per_page: perPage } })
  );
}

// ---- Share of Voice ----

export function getShareOfVoice(profileUuid: string): Promise<ShareOfVoiceResponse> {
  return request(() => client.get(`/api/v1/profiles/${profileUuid}/share-of-voice`));
}
