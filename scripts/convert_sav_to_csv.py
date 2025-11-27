"""Usage:
  convert_sav_to_csv.py <sav_file> [<output_csv>]
  convert_sav_to_csv.py -h | --help

Options:
  -h --help     Show this screen.
"""

import pyreadstat
import pandas as pd  # noqa
import argparse
from pathlib import Path


def sav_to_csv(sav_file, output_csv):
    # Read the .sav file
    df, meta = pyreadstat.read_sav(sav_file)

    # Save as CSV
    df.to_csv(output_csv, index=False)

    print(f"Successfully converted {sav_file} to {output_csv}")


if __name__ == "__main__":
    assert __doc__ is not None, "Docstring is missing"
    parser = argparse.ArgumentParser(
        description="Convert a .sav file to .csv format."
    )
    parser.add_argument("sav_file", help="Path to the .sav file to convert.")
    parser.add_argument(
        "output_csv",
        nargs="?",
        default=None,
        help="Path to the output .csv file (optional). "
        "If not provided, the output will be saved in the same directory "
        "as the input file with a .csv extension.",
    )
    args = parser.parse_args()

    sav_file_path = Path(args.sav_file)
    output_csv_path = args.output_csv

    if not output_csv_path:
        output_csv_path = sav_file_path.with_suffix(".csv")
    else:
        output_csv_path = Path(output_csv_path)

    sav_to_csv(str(sav_file_path), str(output_csv_path))
