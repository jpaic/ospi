from etl.signals.metadata import fetch_metadata_signals, store_metadata_signals
from etl.signals.population import fetch_population_signals, store_population_signals
from etl.signals.electricity import fetch_electricity_signals, store_electricity_signals

def run_metadata():
    print("Running metadata ETL...")
    data = fetch_metadata_signals()
    if data:
        store_metadata_signals(data)
    print("Done.\n")

def run_population():
    print("Running population ETL...")
    data = fetch_population_signals()
    if data:
        store_population_signals(data)
    print("Done.\n")

def run_electricity():
    print("Running electricity ETL...")
    data = fetch_electricity_signals()
    if data:
        store_electricity_signals(data)
    print("Done.\n")



if __name__ == "__main__":
    #run_population()
    run_metadata()
    #run_electricity()