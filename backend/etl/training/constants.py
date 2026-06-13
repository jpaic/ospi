"""
constants.py
Shared training constants used by both trainer.py and evaluate.py.

Centralised here so thresholds stay in sync — change once, applies everywhere.
"""

# Minimum number of countries that must pass the signal-coverage filter before
# training proceeds. Raising this increases data quality at the cost of coverage.
MIN_TRAINING_COUNTRIES: int = 36

# CV R² below this value triggers a health warning in model_health_report()
# and a logged warning at the end of run_training().
MIN_R2_THRESHOLD: float = 0.75