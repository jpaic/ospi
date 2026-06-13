import logging

from etl.signals.metadata import fetch_metadata_signals, store_metadata_signals
from etl.signals.population import fetch_population_signals, store_population_signals
from etl.signals.electricity import fetch_electricity_signals, store_electricity_signals
from etl.signals.telecom import fetch_telecom_signals, store_telecom_signals
from etl.signals.nightlights import fetch_nightlights_signals, store_nightlights_signals
from etl.training.confidence import update_confidence
from db.connection import get_conn

logger = logging.getLogger(__name__)


def clear_table(table_name: str):
    allowed_tables = {"populations", "country_metadata"}
    if table_name not in allowed_tables:
        raise ValueError(f"Refusing to clear unexpected table: {table_name}")

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(f"DELETE FROM {table_name}")
        conn.commit()

    logger.info("Cleared table '%s'", table_name)


def clear_signal_type(signal_type: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM signals WHERE signal_type = %s",
                (signal_type,),
            )
        conn.commit()

    logger.info("Cleared signals for '%s'", signal_type)


def _run_etl(name: str, fetch_fn, store_fn, clear_fn=None):
    logger.info("Running %s ETL...", name)
    data = fetch_fn()
    if data:
        if clear_fn:
            clear_fn()
        store_fn(data)
    logger.info("%s ETL done.", name)


def run_metadata():
    _run_etl("metadata", fetch_metadata_signals, store_metadata_signals,
             lambda: clear_table("country_metadata"))


def run_population():
    _run_etl("population", fetch_population_signals, store_population_signals,
             lambda: clear_table("populations"))


def run_electricity():
    _run_etl("electricity", fetch_electricity_signals, store_electricity_signals,
             lambda: clear_signal_type("electricity"))


def run_telecom():
    _run_etl("telecom", fetch_telecom_signals, store_telecom_signals,
             lambda: clear_signal_type("telecom"))


def run_nightlights():
    _run_etl("nightlights", fetch_nightlights_signals, store_nightlights_signals,
             lambda: clear_signal_type("nightlights"))


def run_model_training() -> dict:
    from etl.training.trainer import run_training
    from services.estimator import _invalidate_model_cache

    logger.info("Running ML model training (v3 ElasticNet)...")

    counts = update_confidence()
    logger.info("Confidence updated — high=%d med=%d low=%d",
                counts["high"], counts["med"], counts["low"])

    apply_schema_patches()

    result = run_training()

    _invalidate_model_cache()

    logger.info(
        "Training complete: model_id=%s  R²=%s  n=%d  λ=%s",
        result["model_id"], result["r_squared"], result["n_training"], result["lambda"],
    )
    return result


def apply_schema_patches():
    from pathlib import Path

    patches = [
        Path(__file__).resolve().parent.parent / "db" / "patches" / "model_schema_patch.sql",
    ]

    with get_conn() as conn:
        with conn.cursor() as cur:
            for patch_path in patches:
                if patch_path.exists():
                    logger.info("Applying patch: %s", patch_path.name)
                    cur.execute(patch_path.read_text())
                else:
                    logger.warning("Patch not found (skipping): %s", patch_path)
        conn.commit()
    logger.info("Schema patches applied.")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

    run_electricity()
    run_telecom()
    run_nightlights()
    logger.info("ETL jobs completed.")

    run_model_training()
    logger.info("Model training completed.")
