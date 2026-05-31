from etl.signals.metadata import fetch_metadata_signals, store_metadata_signals
from etl.signals.population import fetch_population_signals, store_population_signals
from etl.signals.electricity import fetch_electricity_signals, store_electricity_signals
from etl.signals.telecom import fetch_telecom_signals, store_telecom_signals
from etl.signals.internet import fetch_internet_signals, store_internet_signals
from etl.signals.building import fetch_building_signals, store_building_signals
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

def run_building():
    print("Running building-density ETL...")
    data = fetch_building_signals()
    if data:
        clear_signal_type("building")
        store_building_signals(data)
    print("Done.\n")


if __name__ == "__main__":
    run_population()
    run_metadata()
    run_electricity()
    run_telecom()
    run_internet()
    run_building()
    print("ETL jobs completed.")
