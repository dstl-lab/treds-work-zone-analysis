# %%
import pandas as pd
import numpy as np
import json

from utils import (
    plot_vehicle_data,
    plot_vehicle_sparklines,
    display_df,
    save_df_to_json,
)

# %%
from pathlib import Path

data_path = Path(
    "../data/3-31_4-16_DataAfterControlFixandAlertDistanceChange.csv"
    #     "../data/small.csv"
)


# %%
def parse_timestamps(df):
    """
    It looks like the visit_timestamp is a duplicate of the visit_date, so we'll
    drop it and parse visit_date instead. Same deal for the event_time and
    event_timestamp columns.
    """
    return df.assign(
        visit_date=pd.to_datetime(
            df["visit_date"], format="%Y-%m-%dT%H:%M:%S"
        ),
        event_time=pd.to_datetime(df["event_time"], format="mixed"),
    ).drop(columns=["visit_timestamp", "event_timestamp"])


def split_coordinates(df):
    """
    Split the coordinates column into separate latitude and longitude columns.
    """
    df = df.copy()
    df[["longitude", "latitude"]] = df["coordinates"].str.split(
        ",", expand=True
    )
    df["longitude"] = df["longitude"].astype(np.float32)
    df["latitude"] = df["latitude"].astype(np.float32)
    return df


new_names = {
    "Vehicle#": "vehicle_id",
    "District": "district",
    "Column1.visit_date": "visit_date",
    "Column1.visit_date.date.time": "visit_timestamp",
    "Column1.control_group_data": "is_control_group",
    "Column1.workzone_id": "workzone_id",
    "Column1.ref_id": "is_chins_reportable",
    "Column1.cause": "cause",
    "Column1.message": "message",
    "Column1.points.features.geometry.coordinates": "coordinates",
    "Column1.points.features.properties.speed": "speed",
    "Column1.points.features.properties.bearing": "bearing",
    "Column1.points.features.properties.timestamp": "event_time",
    "Column1.points.features.properties.timestamp.date.time": "event_timestamp",
    "Column1.points.features.properties.accel": "acceleration",
    "Column1.visits.location": "visit_location",
}
column_names = list(new_names.values())

#
dtype_spec = {
    "vehicle_id": pd.UInt32Dtype(),
    "district": pd.UInt8Dtype(),
    "is_control_group": bool,
    "speed": np.float32,
    "bearing": np.float32,
    "acceleration": np.float32,
}

# %%
df = (
    pd.read_csv(
        data_path,
        names=column_names,
        skiprows=1,
        dtype=dtype_spec,
    )
    .pipe(parse_timestamps)
    .pipe(split_coordinates)
    .sort_values(["vehicle_id", "event_time"])
)
df

# %%
# Group data and save to JSON in the desired nested format

min_vehicles_per_workzone = 25

# columns that are are the same for a given vehicle_id
static_cols = [
    "vehicle_id",
    "district",
    "visit_date",
    "is_control_group",
    "workzone_id",
    "is_chins_reportable",
    "cause",
    "message",
]

# columns that are different for a given vehicle_id
timeseries_cols = [
    "event_time",
    "speed",
    "acceleration",
]

# precision for float columns
precision_map = {
    "speed": 1,  # e.g., 66.4
    "acceleration": 1,  # e.g., 66.4
    "longitude": 5,  # e.g., -115.74542
    "latitude": 5,  # e.g., 33.07761
}


# Helper to safely round floats, handling NaN
def round_float(value, precision):
    # Check if value is a float-like type and not NaN before rounding
    if pd.notna(value) and isinstance(value, (float, np.floating)):
        return round(value, precision)
    # Return None for NaN/NaT so it becomes null in JSON
    # Keep other types (like strings, ints, Timestamps) as they are
    elif pd.isna(value):
        return None
    return value  # Return original value if not float or NaN


def process_one_vehicle(group):
    """
    Processes a DataFrame group for a single vehicle into a more compact nested
    dictionary format for JSON serialization. Reduces float precision, removes
    specified columns, keeps original timestamp format and record structure.
    """
    # Extract static data from the first row
    static_data = group.iloc[0][static_cols].to_dict()
    static_data["visit_date"] = static_data["visit_date"].isoformat()
    static_data["is_control_group"] = bool(static_data["is_control_group"])
    # Replace NaN message with None for JSON compatibility
    for col in static_cols:
        if pd.isna(static_data[col]):
            static_data[col] = None

    # Prepare time-series data
    timeseries_df = group[
        timeseries_cols
    ].copy()  # Uses updated timeseries_cols

    # Keep original event_time format
    timeseries_df["event_time"] = timeseries_df["event_time"].apply(
        lambda x: x.isoformat() if pd.notna(x) else None
    )

    # Round floats and handle NaNs for specified columns
    for col, precision in precision_map.items():
        if col in timeseries_df.columns:
            # Apply rounding function; it handles NaNs and non-float types
            timeseries_df[col] = timeseries_df[col].apply(
                lambda x: round_float(x, precision)
            )

    # Keep list-of-dictionaries format
    timeseries_data = timeseries_df.to_dict("records")

    # Convert any remaining pd.NA or np.nan in the list of dicts to None for JSON
    # (round_float handles columns in precision_map, this catches others like potentially event_time if it was NaT)
    cleaned_timeseries_data = []
    for row in timeseries_data:
        cleaned_row = {k: (None if pd.isna(v) else v) for k, v in row.items()}
        cleaned_timeseries_data.append(cleaned_row)

    # Combine static and time-series data
    output_record = static_data
    output_record["data"] = cleaned_timeseries_data  # Use the cleaned data
    return output_record


print("Grouping data for JSON export...")
print(
    f"Filtering workzones with at least {min_vehicles_per_workzone} vehicles..."
)
workzone_counts = df.groupby("workzone_id")["vehicle_id"].nunique()
valid_workzones = workzone_counts[
    workzone_counts >= min_vehicles_per_workzone
].index
df_filtered = df[df["workzone_id"].isin(valid_workzones)].copy()
print(
    f"Filtered dataframe contains {len(df_filtered)} rows "
    f"from {len(valid_workzones)} workzones."
)
# %%
by_workzone = (
    df_filtered.groupby(["workzone_id", "vehicle_id"])[
        static_cols + timeseries_cols
    ]
    .apply(process_one_vehicle)
    .groupby(level="workzone_id")
    .agg(list)
)

# %%
output_folder = Path("../docs/data/workzones")
output_folder.mkdir(parents=True, exist_ok=True)
for workzone_id, data in by_workzone.items():
    output_path = output_folder / f"{workzone_id}.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"))
    print(f"Successfully saved {output_path}")

# %%
meta_file = Path("../docs/data/workzones-metadata.json")
(
    by_workzone.apply(len)
    .rename("n")
    .sort_values(ascending=False)
    .to_frame()
    .reset_index()
    .to_json(meta_file, orient="records")
)
print(f"Successfully saved {meta_file}")

# %%
# vehicle_id	265851
# district	11
# visit_date	2025-01-15 20:44:41
# is_control_group	0.0
# workzone_id	8-6862
# is_chins_reportable	C86GA-3
# cause	Bridge Work
# message	Left Lane Closed
# coordinates	-115.7454182,33.0776103
# speed	66.4
# bearing	126.0
# event_time	2025-01-15 20:44:11.535000
# acceleration	NaN
# brake_average	NaN
# brake_maximum	NaN
# brake_start	NaN
# brake_stop	NaN
# longitude	-115.75
# latitude	33.08
display_df(df.iloc[0].to_frame(), rows=19)


# %%
df["vehicle_id"].value_counts()

# %%
v1 = df.query("vehicle_id == 347303")
v1.plot(x="event_time", y="speed")

# %%
v1 = df.query("vehicle_id == 339306")
v1.plot(x="event_time", y="speed")
# v1.plot(x="event_time", y="acceleration")

# %%
v1
