from app.utils.scoring import calculate_opportunity_score


def test_not_visible_scores_higher_than_visible_all_else_equal():
    not_visible = calculate_opportunity_score(
        estimated_search_volume=1000, competitive_difficulty=50,
        domain_visible=False, query_intent="informational",
    )
    visible = calculate_opportunity_score(
        estimated_search_volume=1000, competitive_difficulty=50,
        domain_visible=True, visibility_position=1, query_intent="informational",
    )
    assert not_visible > visible


def test_lower_difficulty_scores_higher_all_else_equal():
    easy = calculate_opportunity_score(
        estimated_search_volume=1000, competitive_difficulty=10, domain_visible=False,
    )
    hard = calculate_opportunity_score(
        estimated_search_volume=1000, competitive_difficulty=90, domain_visible=False,
    )
    assert easy > hard


def test_higher_volume_scores_higher_all_else_equal():
    high_volume = calculate_opportunity_score(
        estimated_search_volume=5000, competitive_difficulty=50, domain_visible=False,
    )
    low_volume = calculate_opportunity_score(
        estimated_search_volume=50, competitive_difficulty=50, domain_visible=False,
    )
    assert high_volume > low_volume


def test_comparison_intent_scores_higher_than_definitional_all_else_equal():
    comparison = calculate_opportunity_score(
        estimated_search_volume=1000, competitive_difficulty=50,
        domain_visible=False, query_intent="comparison",
    )
    definitional = calculate_opportunity_score(
        estimated_search_volume=1000, competitive_difficulty=50,
        domain_visible=False, query_intent="definitional",
    )
    assert comparison > definitional


def test_score_is_always_within_bounds():
    extreme_high = calculate_opportunity_score(
        estimated_search_volume=1_000_000, competitive_difficulty=0,
        domain_visible=False, query_intent="comparison",
    )
    extreme_low = calculate_opportunity_score(
        estimated_search_volume=0, competitive_difficulty=100,
        domain_visible=True, visibility_position=1, query_intent="definitional",
    )
    assert 0.0 <= extreme_high <= 1.0
    assert 0.0 <= extreme_low <= 1.0


def test_missing_data_does_not_crash_and_returns_neutral_ish_score():
    score = calculate_opportunity_score(
        estimated_search_volume=None, competitive_difficulty=None,
        domain_visible=None, visibility_position=None, query_intent=None,
    )
    assert 0.0 <= score <= 1.0
