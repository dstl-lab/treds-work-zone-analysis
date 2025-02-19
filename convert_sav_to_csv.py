import pyreadstat
import pandas as pd

def sav_to_csv(sav_file, output_csv):
    # Read the .sav file
    df, meta = pyreadstat.read_sav(sav_file)
    
    # Save as CSV
    df.to_csv(output_csv, index=False)
    
    print(f"Successfully converted {sav_file} to {output_csv}")

# Example usage
sav_to_csv("raw_data/11-23-12-23Cleaned_5.sav", "data.csv")