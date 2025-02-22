# %%
import pandas as pd
import numpy as np
import json
import math
import gzip

from utils import (
    plot_vehicle_data,
    plot_vehicle_sparklines,
    display_df,
    save_df_to_json,
)

# %%
from pathlib import Path

data_path = Path("../data/filtered-work-zones.csv")


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
    "Column1.points.features.properties.brake_avg": "brake_average",
    "Column1.points.features.properties.brake_max": "brake_maximum",
    "Column1.points.features.properties.brake_start": "brake_start",
    "Column1.points.features.properties.brake_stop": "brake_stop",
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
    "brake_average": np.float32,
    "brake_maximum": np.float32,
    "brake_start": np.float32,
    "brake_stop": np.float32,
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
timeseries_cols = [
    "event_time",
    "speed",
    "longitude",
    "latitude",
]


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


# Define precision for remaining float columns
precision_map = {
    "speed": 1,  # e.g., 66.4
    "longitude": 5,  # e.g., -115.74542
    "latitude": 5,  # e.g., 33.07761
    # No need for bearing/acceleration precision
}


def process_vehicle_group_revised(group):
    """
    Processes a DataFrame group for a single vehicle into a more compact
    nested dictionary format for JSON serialization. Reduces float precision,
    removes specified columns, keeps original timestamp format and record structure.
    """
    # Extract static data from the first row
    static_data = group.iloc[0][static_cols].to_dict()
    static_data["visit_date"] = static_data["visit_date"].isoformat()
    static_data["is_control_group"] = bool(static_data["is_control_group"])
    # Replace NaN message with None for JSON compatibility
    if pd.isna(static_data["message"]):
        static_data["message"] = None
    # Add handling for other potential NaNs in static data if necessary

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
# Filter workzones with at least 10 vehicles
print("Filtering workzones with at least 10 vehicles...")
workzone_counts = df.groupby("workzone_id")["vehicle_id"].nunique()
valid_workzones = workzone_counts[workzone_counts >= 10].index
df_filtered = df[df["workzone_id"].isin(valid_workzones)].copy()
print(
    f"Filtered dataframe contains {len(df_filtered)} rows "
    f"from {len(valid_workzones)} workzones."
)

# Use the revised processing function
grouped_list = [
    process_vehicle_group_revised(group)  # Use the revised function
    for _, group in df_filtered.groupby("vehicle_id")
]

# Save as compressed JSON (.json.gz)
output_path = Path(
    "../docs/data/filtered-work-zones-grouped.json.gz"
)  # Note the .gz extension
print(f"Saving grouped data to {output_path}...")

# Use gzip.open with 'wt' mode for writing text
with gzip.open(output_path, "wt", encoding="utf-8") as f:
    # Use compact separators for smallest size
    json.dump(grouped_list, f, separators=(",", ":"))

print(f"Successfully saved grouped data to {output_path}")

# Also save as regular JSON
output_path_json = Path("../docs/data/filtered-work-zones-grouped.json")
print(f"Saving uncompressed grouped data to {output_path_json}...")
with open(output_path_json, "w", encoding="utf-8") as f:
    json.dump(grouped_list, f, separators=(",", ":"))
print(f"Successfully saved uncompressed grouped data to {output_path_json}")


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
v1 = df.query("vehicle_id == 279313")
v1[["event_time", "speed"]].plot(x="event_time", y="speed")


# %%
# Function to determine if a vehicle has high entry speed (avg ≥ 50 mph in first 5 records)
def has_high_entry_speed(group):
    # Get the first 5 records or all if less than 5
    first_records = group.head(5)
    # Calculate the average speed of these records
    avg_speed = first_records["speed"].mean()
    # Return True if average speed is at least 50 mph
    return avg_speed >= 50


# Group by vehicle_id and apply the function
has_high_entry_speed = (
    df.groupby("vehicle_id")[["speed"]]
    .apply(has_high_entry_speed)
    .rename("has_high_entry_speed")
)
has_high_entry_speed


# %%
# Group by vehicle_id and analyze speed data
def check_slowdown(group):
    # Set a 20-second window size
    window_size = 20

    # If less than window_size measurements, we can't determine a 20-second window
    if len(group) < window_size:
        return False

    # Calculate rolling average with 20-second window
    rolling_avg = group["speed"].rolling(window=window_size).mean()

    # Check if any window has average speed <= 10 mph
    return (rolling_avg <= 10).any()


has_slowdown = (
    df.groupby("vehicle_id")[["speed"]]
    .apply(check_slowdown)
    .rename("has_slowdown")
)
has_slowdown

# %%
started_fast_but_slowed_down = (has_high_entry_speed & has_slowdown).rename(
    "started_fast_but_slowed_down"
)
vids = np.unique(
    started_fast_but_slowed_down[started_fast_but_slowed_down].index
)
print(
    f"""
There are {len(vids)} vehicles that started fast (avg speed > 50 mph in first 5
records) but slowed down (avg speed <= 10 mph in any 20 second window).
""".strip()
)

# %%
vid = 254207
plot_vehicle_data(df, vid)

# %%
v1 = df.query("vehicle_id == @vid")
workzone_id = v1["workzone_id"].iloc[0]

# %%
slowdowns = df.query("vehicle_id in @vids")
slowdowns

# %%
workzones = (
    slowdowns.groupby("vehicle_id")
    .first()["workzone_id"]
    .value_counts()
    .to_frame()
    .query("count > 3")
    .index
)
workzones

# %%
for workzone_id in workzones:
    slowdowns_one_zone = slowdowns.query("workzone_id == @workzone_id")
    slowdowns_one_zone

    fig = plot_vehicle_sparklines(
        slowdowns_one_zone,
        slowdowns_one_zone["vehicle_id"].unique(),
        workzone_id=workzone_id,
    )
    pdf_name = f"figures/slowdowns-in-{workzone_id}.pdf"
    fig.savefig(pdf_name, dpi=300)
    print(f"Saved {pdf_name}")
