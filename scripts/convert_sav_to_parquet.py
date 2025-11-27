#!/usr/bin/env python3
"""Convert SPSS .sav files to Parquet format for faster queries.

Sam: took me about 3 hours to convert a 5 GB .sav file!

Usage:
    python scripts/sav_to_parquet.py raw_data/8-18_9-18.sav
    python scripts/sav_to_parquet.py raw_data/8-18_9-18.sav -o data/8-18_9-18.parquet
"""

import argparse
from pathlib import Path

import duckdb


def convert_sav_to_parquet(input_path: Path, output_path: Path) -> None:
    """Convert a .sav file to Parquet format with cleaned column names."""
    duckdb.sql("INSTALL read_stat FROM community")
    duckdb.sql("LOAD read_stat")
    duckdb.sql("SET enable_progress_bar = true")

    print(f"Converting {input_path.name} to Parquet...")
    duckdb.sql(f"""
        COPY (
            SELECT
                "Vehicle#"::UINTEGER AS vehicle_id,
                "District"::UTINYINT AS district,
                "Column1.visits.lcs.closure.isCHINReportable"::BOOLEAN AS is_chins_reportable,
                strptime("Column1.visit_date", '%Y-%m-%dT%H:%M:%S') AS visit_date,
                "Column1.control_group_data"::BOOLEAN AS is_control_group,
                "Column1.workzone_id" AS workzone_id,
                "Column1.cause" AS cause,
                "Column1.message" AS message,
                "Column1.points.features.properties.speed"::FLOAT AS speed,
                "Column1.points.features.properties.bearing"::FLOAT AS bearing,
                strptime(
                    "Column1.points.features.properties.timestamp",
                    '%Y-%m-%dT%H:%M:%S.%g'
                ) AS event_time,
                "Column1.points.features.properties.accel"::FLOAT AS acceleration,
                "Column1.visits.location" AS visit_location,
                split_part("Column1.points.features.geometry.coordinates", ',', 1)::FLOAT AS longitude,
                split_part("Column1.points.features.geometry.coordinates", ',', 2)::FLOAT AS latitude
            FROM read_stat('{input_path}')
        ) TO '{output_path}' (FORMAT PARQUET, COMPRESSION ZSTD)
    """)

    # Get file sizes for comparison
    input_size = input_path.stat().st_size / (1024 * 1024)
    output_size = output_path.stat().st_size / (1024 * 1024)
    compression_ratio = input_size / output_size

    print(f"Converted {input_path} -> {output_path}")
    print(f"  Input size:  {input_size:.1f} MB")
    print(f"  Output size: {output_size:.1f} MB")
    print(f"  Compression: {compression_ratio:.1f}x")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert SPSS .sav files to Parquet format for faster queries.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "input",
        type=Path,
        help="Path to the input .sav file",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Path to the output .parquet file. Defaults to data/<input_stem>.parquet",
    )
    args = parser.parse_args()

    input_path = args.input.resolve()
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    if args.output:
        output_path = args.output.resolve()
    else:
        # Default to data/ directory with same stem
        project_root = Path(__file__).resolve().parent.parent
        output_path = project_root / "data" / f"{input_path.stem}.parquet"

    output_path.parent.mkdir(parents=True, exist_ok=True)

    convert_sav_to_parquet(input_path, output_path)


if __name__ == "__main__":
    main()
