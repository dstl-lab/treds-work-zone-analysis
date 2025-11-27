# %%
from pathlib import Path

import matplotlib.pyplot as plt
import seaborn as sns
from duckdb import sql
from matplotlib_inline.backend_inline import set_matplotlib_formats

set_matplotlib_formats("svg")
sns.set_context("notebook")
sns.set_style("whitegrid")
plt.rcParams["figure.figsize"] = (10, 5)

project_root = Path(__file__).resolve().parent.parent

data = project_root / "data" / "8-18_9-18.parquet"
output_dir = project_root / "docs" / "8-18_9-18" / "src" / "data"
output_dir.mkdir(parents=True, exist_ok=True)

sql("INSTALL spatial")
sql("LOAD spatial")

# %%
# columns in parquet file
sql(f"""
    DESCRIBE '{data}'
""").df()
# %%
sql(f"""
    SELECT
      COUNT(*) AS n_rows,
    FROM '{data}'
""").df()
# %%
# is_chins_reportable is the same within a workzone
df = sql(f"""
    SELECT
      district,
      workzone_id,
      is_chins_reportable,
      is_control_group,
      COUNT(DISTINCT vehicle_id) AS n,
    FROM '{data}'
    GROUP BY
      district,
      workzone_id,
      is_chins_reportable,
      is_control_group,
    ORDER BY
      district,
      workzone_id,
      is_chins_reportable,
      is_control_group
""").df()
df


# %%
vid = 532633
df = sql(f"""
    SELECT
      *
    FROM '{data}'
    WHERE vehicle_id = {vid}
    ORDER BY
      event_time
""").df()
df
# %%
df = sql(f"""
    SELECT
      workzone_id,
      FIRST(is_chins_reportable) AS is_chins_reportable,
      COUNT(DISTINCT vehicle_id) AS n,
    FROM '{data}'
    GROUP BY
      workzone_id
    ORDER BY
      n DESC
""").df()
df


# %%
# construct vehicle data for one workzone
workzone_id = "8-15200"
df = sql(f"""
    SELECT
      vehicle_id,
      visit_date: ANY_VALUE(visit_date),
      is_control_group: ANY_VALUE(is_control_group),
      -- one unique message per vehicle
      message: ANY_VALUE(message),
      data: LIST({{
        event_time: event_time,
        speed: ROUND(speed, 1),
        acceleration: ROUND(acceleration, 1),
      }} ORDER BY event_time),
    FROM '{data}'
    WHERE
      workzone_id = '{workzone_id}'
    GROUP BY
      vehicle_id
    ORDER BY
      visit_date
""").df()
df

# %%
# workzones with at least 20 control group vehicles
sql(f"""
CREATE OR REPLACE TABLE workzones AS (
    SELECT
      workzone_id,
      district: ANY_VALUE(district),
      is_chins_reportable: ANY_VALUE(is_chins_reportable),
      cause: ANY_VALUE(cause),
      test_n: COUNT(DISTINCT vehicle_id)
        FILTER (WHERE is_control_group = FALSE),
      control_n: COUNT(DISTINCT vehicle_id)
        FILTER (WHERE is_control_group = TRUE),
    FROM '{data}'
    GROUP BY
      workzone_id
    HAVING
      control_n >= 20
    ORDER BY
      control_n DESC
)
""")

sql(f"""
COPY workzones TO '{output_dir / "workzones.json"}'
""")

# %%
df = sql("""
    FROM workzones
    LIMIT 5
""").df()
df

# %%
# construct vehicle data for all workzones
sql(f"""
CREATE OR REPLACE TABLE vehicles AS (
    SELECT
      workzone_id: ANY_VALUE(workzone_id),
      vehicle_id,
      visit_date: ANY_VALUE(visit_date),
      is_control_group: ANY_VALUE(is_control_group),
      -- one unique message per vehicle
      message: ANY_VALUE(message),
      data: LIST({{
        event_time: event_time,
        speed: ROUND(speed, 1),
        acceleration: ROUND(acceleration, 1),
      }} ORDER BY event_time),
    FROM '{data}'
      JOIN workzones USING (workzone_id)
    GROUP BY
      vehicle_id
    ORDER BY
      visit_date
)
""")

# %%
df = sql("""
    FROM vehicles
    LIMIT 5
""").df()
df

# %%
# save vehicles to parquet files, partitioned by workzone_id
sql(f"""
COPY vehicles TO '{output_dir / "vehicles"}'
(FORMAT parquet, PARTITION_BY (workzone_id), OVERWRITE)
""")

# %%
[
    f"{p.parent.name:>19}/{p.name}: {p.stat().st_size / 1024 / 1024:.1f} MB"
    for p in (output_dir / "vehicles").glob("**/*.parquet")
]

# %%
# just double checking that the parquet file is correct
parquet_file = (
    output_dir / "vehicles" / "workzone_id=8-15200" / "data_0.parquet"
)
sql(f"""
    FROM parquet_schema('{parquet_file}')
""").df()
# %%
# let's make some basic plots
workzone_id = "8-15199"
df = sql(f"""
    SELECT
      vehicle_id,
      is_control_group,
      message: ANY_VALUE(message),
      visit_date: ANY_VALUE(visit_date),
      event_time: time_bucket(INTERVAL '10 seconds', event_time),
      speed: AVG(speed),
      acceleration: AVG(acceleration),
    FROM '{data}'
    WHERE
      workzone_id = '{workzone_id}' AND
      visit_date >= '2025-08-19' AND
      visit_date < '2025-08-30'
    GROUP BY
      vehicle_id,
      is_control_group,
      time_bucket(INTERVAL '10 seconds', event_time)
    ORDER BY
      vehicle_id,
      event_time
""").df()
df

# %%
plt.figure(figsize=(1000, 1))
sns.lineplot(
    data=df,
    x="event_time",
    y="speed",
    hue="is_control_group",
    units="vehicle_id",
    estimator=None,
    errorbar=None,
)

# %%
# what about by lat/lon?
workzone_id = "8-15200"
df = sql(f"""
    SELECT
      *
    FROM '{data}'
    WHERE
      workzone_id = '{workzone_id}' AND
      visit_date >= '2025-08-19 07:00:00' AND
      visit_date < '2025-08-19 12:00:00'
    ORDER BY
      event_time
""").df()

plt.figure(figsize=(5, 3))
sns.scatterplot(
    data=df,
    x="longitude",
    y="latitude",
    hue="speed",
    s=10,
    linewidth=0,
    alpha=0.2,
)
# %%
# workzone_id = "8-15200"
# vid = 532633
# vid = 483454
vid = 483528
df = sql(f"""
WITH points AS (
    SELECT
      row_number() OVER (ORDER BY event_time) AS row_number,
      point: ST_MakePoint(longitude, latitude)::GEOMETRY,

      key: ST_QuadKey(point, 17),
      -- sam: precision of 17 seems like a good balance of resolution and
      -- data density
    FROM '{data}'
    WHERE
      vehicle_id = '{vid}'
    ORDER BY
      event_time
)
SELECT
  p: MIN(point),
  min_row: MIN(row_number),
  lon: ST_X(p),
  lat: ST_Y(p),
FROM points
GROUP BY
  key
ORDER BY
  min_row
""").df()

sns.lineplot(
    data=df,
    x="lon",
    y="lat",
    markers=True,
    sort=False,
    marker="o",
    errorbar=None,
)

# %%
