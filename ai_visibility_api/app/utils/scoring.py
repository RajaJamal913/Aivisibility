"""
Opportunity Score Formula
==========================

Produces a 0.0-1.0 score representing how valuable it would be for the
target domain to appear in the AI-generated answer for a given query.

The score is a weighted blend of four factors, each independently
normalised to [0, 1] before weighting so that no single factor (e.g. raw
search volume, which can range from 10 to 100,000+) dominates the sum by
virtue of scale alone:

    opportunity_score = 0.35 * volume_score
                       + 0.25 * difficulty_score
                       + 0.25 * visibility_gap_score
                       + 0.15 * intent_score

Rationale for weights
----------------------
- **Volume (35%)** is the single largest factor because it directly caps
  the ceiling of the opportunity -- even a wide-open, low-difficulty gap on
  a query nobody asks is low value.
- **Difficulty (25%)** matters almost as much as volume: a high-volume
  query dominated by entrenched competitors is a poor use of near-term
  content effort compared to an easier, slightly-lower-volume one.
- **Visibility gap (25%)** is binary-ish (not appearing at all = maximum
  gap) but deliberately weighted below volume/difficulty rather than
  above them, because "we are already invisible everywhere" alone doesn't
  make a query worth chasing if nobody searches it or it's uncapturable.
- **Commercial intent (15%)** is a smaller but real modifier: comparison /
  "best of" / vs. queries convert into product consideration far more
  reliably than purely informational ones, so we nudge the score up when
  intent looks commercial, without letting a `#1 best tool` query with
  10 monthly searches beat a high-volume informational one.

Each sub-score:

- ``volume_score``: log-scaled, since search volume is heavily
  right-skewed (a jump from 100 -> 1,000 matters far more than
  10,000 -> 10,900). Normalised against a configurable volume ceiling.
- ``difficulty_score``: ``1 - (difficulty / 100)`` -- lower difficulty
  is better, so we invert it directly (already linear 0-100 input).
- ``visibility_gap_score``: 1.0 if domain is NOT visible for the query,
  0.5 if visible but outside the "safe" top position, 0.15 if
  strongly visible already. A `None` (unknown) visibility defaults to a
  neutral 0.5 so unscored queries don't get an artificially inflated
  or deflated score if this function is ever called before Agent 2 runs.
- ``intent_score``: mapped from the query's tagged intent, defaulting to
  a neutral middle value for untagged/unknown intents.
"""
from __future__ import annotations

import math

# Tunable weights -- kept as module-level constants (not magic numbers
# buried inline) so the formula is easy to audit and adjust in one place.
WEIGHT_VOLUME = 0.35
WEIGHT_DIFFICULTY = 0.25
WEIGHT_VISIBILITY_GAP = 0.25
WEIGHT_INTENT = 0.15

# Search volumes above this are treated as "maximally attractive" for the
# purposes of the log-scaled volume score. Chosen as a reasonable ceiling
# for mid-size B2B SaaS competitive niches; adjust per-vertical if reused.
VOLUME_CEILING = 5000

INTENT_SCORES = {
    "comparison": 1.0,      # "X vs Y"
    "best_of": 0.9,         # "best tool for..."
    "how_to": 0.55,
    "informational": 0.4,
    "definitional": 0.3,    # "what is X"
}
DEFAULT_INTENT_SCORE = 0.5  # untagged / unrecognised intent -> neutral


def _volume_score(estimated_search_volume: int | None) -> float:
    if not estimated_search_volume or estimated_search_volume <= 0:
        return 0.0
    # log1p keeps low volumes from being zeroed out while compressing the
    # long tail of very high volumes.
    scaled = math.log1p(estimated_search_volume) / math.log1p(VOLUME_CEILING)
    return max(0.0, min(1.0, scaled))


def _difficulty_score(competitive_difficulty: int | None) -> float:
    if competitive_difficulty is None:
        return 0.5  # unknown difficulty -> neutral, not optimistic
    difficulty = max(0, min(100, competitive_difficulty))
    return 1.0 - (difficulty / 100.0)


def _visibility_gap_score(domain_visible: bool | None, visibility_position: int | None) -> float:
    if domain_visible is None:
        return 0.5
    if domain_visible is False:
        return 1.0
    # Visible, but a weak/late position still represents a meaningful gap.
    if visibility_position is not None and visibility_position > 3:
        return 0.5
    return 0.15


def _intent_score(query_intent: str | None) -> float:
    if not query_intent:
        return DEFAULT_INTENT_SCORE
    return INTENT_SCORES.get(query_intent.lower(), DEFAULT_INTENT_SCORE)


def calculate_opportunity_score(
    *,
    estimated_search_volume: int | None,
    competitive_difficulty: int | None,
    domain_visible: bool | None,
    visibility_position: int | None = None,
    query_intent: str | None = None,
) -> float:
    """Compute the 0.0-1.0 opportunity score for a single scored query.

    All inputs are optional/nullable because Agent 2 may partially fail or
    return incomplete data for a given query; this function always returns
    a usable float rather than raising, so a partial scoring failure never
    blocks the rest of the pipeline.
    """
    volume_score = _volume_score(estimated_search_volume)
    difficulty_score = _difficulty_score(competitive_difficulty)
    visibility_gap_score = _visibility_gap_score(domain_visible, visibility_position)
    intent_score = _intent_score(query_intent)

    raw_score = (
        WEIGHT_VOLUME * volume_score
        + WEIGHT_DIFFICULTY * difficulty_score
        + WEIGHT_VISIBILITY_GAP * visibility_gap_score
        + WEIGHT_INTENT * intent_score
    )
    return round(max(0.0, min(1.0, raw_score)), 4)
