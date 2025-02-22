from pathlib import Path
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import seaborn as sns
from matplotlib_inline.backend_inline import set_matplotlib_formats
from IPython.display import display, IFrame, HTML

import plotly
import plotly.figure_factory as ff
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import plotly.io as pio

# DSC 80 preferred styles
pio.templates["dsc80"] = go.layout.Template(
    layout=dict(
        margin=dict(l=30, r=30, t=30, b=30),
        autosize=True,
        width=600,
        height=400,
        xaxis=dict(showgrid=True),
        yaxis=dict(showgrid=True),
        title=dict(x=0.5, xanchor="center"),
    )
)
pio.templates.default = "simple_white+dsc80"

set_matplotlib_formats("svg")
sns.set_context("notebook")
sns.set_style("whitegrid")
plt.rcParams["figure.figsize"] = (10, 5)

# display options for numpy and pandas
np.set_printoptions(threshold=20, precision=2, suppress=True)
pd.set_option("display.max_rows", 7)
pd.set_option("display.max_columns", 8)
pd.set_option("display.precision", 2)

# Use plotly as default plotting engine
pd.options.plotting.backend = "plotly"


def display_df(
    df, rows=pd.options.display.max_rows, cols=pd.options.display.max_columns
):
    """Displays n rows and cols from df"""
    with pd.option_context(
        "display.max_rows", rows, "display.max_columns", cols
    ):
        display(df)


def dfs_side_by_side(*dfs):
    """
    Displays two or more dataframes side by side.
    """
    display(
        HTML(
            f"""
        <div style="display: flex; gap: 1rem;">
        {''.join(df.to_html() for df in dfs)}
        </div>
    """
        )
    )


# %%
def plot_vehicle_data(df, vehicle_id):
    v1 = df.query("vehicle_id == @vehicle_id")
    plt.figure(figsize=(6, 3))
    sns.lineplot(data=v1, x="event_time", y="speed")

    plt.axhline(y=55, color="black", linestyle=":", label="Speed Limit")
    plt.axhline(y=0, color="black", linestyle=":", label="Zero Speed")
    plt.axvline(
        x=v1["visit_date"].iloc[0],
        color="red",
        linestyle=":",
        label="Work Zone Start",
    )

    # Customize the plot
    is_control = "Control" if v1["is_control_group"].iloc[0] else "Test"
    plt.title(f"Speed vs Time for Vehicle {vehicle_id} ({is_control})")
    plt.xlabel("Time")
    plt.ylabel("Speed (mph)")

    # Rotate x-axis labels for better readability
    plt.xticks(rotation=45)

    # Adjust layout to prevent label cutoff
    plt.tight_layout()
    plt.show()


def plot_vehicle_sparklines(
    df, vehicle_ids, ncols_per_group=2, workzone_id=None
):
    """
    Create compact sparkline-style plots with control vehicles on the left and test vehicles on the right.

    Args:
        vehicle_ids: List of vehicle IDs to plot
        ncols_per_group: Number of columns for each group (control/test)
    """
    # Separate vehicles into control and test groups
    control_vehicles = []
    test_vehicles = []

    for vid in vehicle_ids:
        is_control = df.query("vehicle_id == @vid")["is_control_group"].iloc[0]
        if is_control:
            control_vehicles.append(vid)
        else:
            test_vehicles.append(vid)

    # Calculate number of rows needed (use max of control and test group sizes)
    nrows = max(
        (len(control_vehicles) + ncols_per_group - 1) // ncols_per_group,
        (len(test_vehicles) + ncols_per_group - 1) // ncols_per_group,
    )

    # Total number of columns is doubled (ncols_per_group for each group)
    total_cols = ncols_per_group * 2

    # Create figure with subplots
    fig, axs = plt.subplots(
        nrows=nrows,
        ncols=total_cols,
        figsize=(2 * total_cols, 1.3 * nrows),
        squeeze=False,
    )

    def plot_vehicle(vehicle_id, ax):
        """Helper function to create individual sparkline plot"""
        v1 = df.query("vehicle_id == @vehicle_id")

        # Create the sparkline plot
        sns.lineplot(data=v1, x="event_time", y="speed", ax=ax, linewidth=1)

        # Add reference lines
        ax.axhline(
            y=55, color="black", linestyle=":", linewidth=0.5, alpha=0.5
        )
        ax.axhline(y=0, color="black", linestyle=":", linewidth=0.5, alpha=0.5)
        ax.axvline(
            x=v1["visit_date"].iloc[0],
            color="red",
            linestyle=":",
            label="Work Zone Start",
        )

        # Customize the plot
        is_control = "Control" if v1["is_control_group"].iloc[0] else "Test"
        ax.set_title(f"Vehicle {vehicle_id}\n({is_control})", fontsize=8)

        # Remove labels and ticks for compactness
        ax.set_xlabel("")
        ax.set_ylabel("")
        ax.tick_params(axis="both", which="both", length=0, labelsize=6)

        # Format datetime ticks more compactly
        ax.xaxis.set_major_formatter(mdates.DateFormatter("%H:%M"))
        for label in ax.get_xticklabels():
            label.set_rotation(45)
            label.set_ha("right")

    # Plot control vehicles in left columns
    for idx, vid in enumerate(control_vehicles):
        row = idx // ncols_per_group
        col = idx % ncols_per_group
        if row < nrows:  # Only plot if we have room
            plot_vehicle(vid, axs[row, col])

    # Plot test vehicles in right columns
    for idx, vid in enumerate(test_vehicles):
        row = idx // ncols_per_group
        col = (idx % ncols_per_group) + ncols_per_group  # Offset to right side
        if row < nrows:  # Only plot if we have room
            plot_vehicle(vid, axs[row, col])

    # Hide empty subplots
    for row in range(nrows):
        for col in range(total_cols):
            # Check if this subplot position should have a plot
            control_idx = row * ncols_per_group + col
            test_idx = row * ncols_per_group + (col - ncols_per_group)

            if (
                col < ncols_per_group and control_idx >= len(control_vehicles)
            ) or (col >= ncols_per_group and test_idx >= len(test_vehicles)):
                axs[row, col].set_visible(False)

    # Add group labels at the top
    fig.suptitle(f"Slowdowns in {workzone_id}", fontsize=10)

    # Adjust layout
    plt.tight_layout()
    fig.subplots_adjust(top=0.85)  # Make room for suptitle
    return fig


def save_df_to_json(
    df: pd.DataFrame, filename: str, data_dir: str = "../data"
):
    """
    Saves a DataFrame to a JSON file in the specified data directory.

    Args:
        df: The pandas DataFrame to save.
        filename: The base name for the output JSON file (e.g., "output_data").
                  '.json' extension will be added if not present.
        data_dir: The directory to save the JSON file in, relative to the script's location.
                  Defaults to "../data".
    """
    output_path = Path(data_dir)
    output_path.mkdir(
        parents=True, exist_ok=True
    )  # Ensure the directory exists

    # Ensure filename ends with .json
    if not filename.endswith(".json"):
        filename += ".json"

    full_path = output_path / filename

    # Save to JSON Lines format (orient='records', lines=True)
    # Use ISO format for datetimes
    df.to_json(
        full_path,
        orient="records",
        lines=True,
        date_format="iso",
        default_handler=str,
    )
    print(f"DataFrame successfully saved to {full_path}")
