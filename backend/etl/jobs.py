from etl.signals.metadata import fetch_metadata_signals, store_metadata_signals
from etl.signals.population import fetch_population_signals, store_population_signals
from etl.signals.electricity import fetch_electricity_signals, store_electricity_signals
from etl.signals.telecom import fetch_telecom_signals, store_telecom_signals
from etl.signals.internet import fetch_internet_signals, store_internet_signals
from etl.signals.mobility import fetch_mobility_signals, store_mobility_signals
from etl.signals.building import fetch_building_signals, store_building_signals
from etl.training.confidence import update_confidence
from db.connection import get_conn


def clear_table(table_name: str):
    allowed_tables = {"populations", "country_metadata"}
    if table_name not in allowed_tables:
        raise ValueError(f"Refusing to clear unexpected table: {table_name}")

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(f"DELETE FROM {table_name}")
        conn.commit()

    print(f"Cleared {table_name}")


def clear_signal_type(signal_type: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM signals WHERE signal_type = %s",
                (signal_type,),
            )
        conn.commit()

    print(f"Cleared {signal_type} signals")


def run_metadata():
    print("Running metadata ETL...")
    data = fetch_metadata_signals()
    if data:
        clear_table("country_metadata")
        store_metadata_signals(data)
    print("Done.\n")


def run_population():
    print("Running population ETL...")
    data = fetch_population_signals()
    if data:
        clear_table("populations")
        store_population_signals(data)
    print("Done.\n")


def run_electricity():
    print("Running electricity ETL...")
    data = fetch_electricity_signals()
    if data:
        clear_signal_type("electricity")
        store_electricity_signals(data)
    print("Done.\n")


def run_telecom():
    print("Running telecom ETL...")
    data = fetch_telecom_signals()
    if data:
        clear_signal_type("telecom")
        store_telecom_signals(data)
    print("Done.\n")


def run_internet():
    print("Running internet ETL...")
    data = fetch_internet_signals()
    if data:
        clear_signal_type("internet")
        store_internet_signals(data)
    print("Done.\n")


def run_mobility():
    print("Running mobility ETL (Numbeo Traffic Index)...")
    data = fetch_mobility_signals()
    if data:
        clear_signal_type("mobility")
        store_mobility_signals(data)
    print("Done.\n")


def run_building():
    print("Running building-density ETL...")
    data = fetch_building_signals()
    if data:
        clear_signal_type("building")
        store_building_signals(data)
    print("Done.\n")


def run_model_training() -> dict:
    """
    Fits the v2 ridge regression model on current DB data and persists
    model_weights + model_residuals.

    Scheduled to run monthly; also triggered by POST /api/admin/retrain.
    Safe to run at any time — inserts a new model_weights row and the
    estimator always loads the most recently trained one.

    Returns dict: {model_id, r_squared, n_training, lambda, coefficients}
    Raises RuntimeError if training data is insufficient.
    """
    print("Running ML model training (v2 ridge regression)...")

    # Lazy import to keep ETL jobs usable without scikit-learn installed
    from etl.training.trainer import run_training
    from services.estimator import _invalidate_model_cache

    counts = update_confidence()
    print(f"Confidence updated — high={counts['high']} med={counts['med']} low={counts['low']}")


    result = run_training()

    apply_schema_patches()

    # Bust the in-process model cache so subsequent requests pick up
    # the new weights immediately without a server restart
    _invalidate_model_cache()

    print(
        f"[training] ✓ model_id={result['model_id']}  "
        f"R²={result['r_squared']}  n={result['n_training']}  "
        f"λ={result['lambda']}"
    )
    print("Done.\n")
    return result


def apply_schema_patches():
    """
    Applies the model schema patch and source-confidence seed patch.
    Safe to run multiple times (all statements are idempotent).
    """
    from pathlib import Path

    patches = [
        Path(__file__).resolve().parent.parent / "db" / "patches" / "model_schema_patch.sql",
    ]

    with get_conn() as conn:
        with conn.cursor() as cur:
            for patch_path in patches:
                if patch_path.exists():
                    print(f"Applying patch: {patch_path.name}")
                    cur.execute(patch_path.read_text())
                else:
                    print(f"Patch not found (skipping): {patch_path}")
        conn.commit()
    print("Schema patches applied.\n")


if __name__ == "__main__":
    #run_population()
    #run_metadata()
    run_electricity()
    run_telecom()
    run_internet()
    #run_mobility()
    run_building()
    print("ETL jobs completed.")

    run_model_training()
    print("Model training completed.")

