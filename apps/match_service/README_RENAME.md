# Player Image Renaming Scripts

This directory contains scripts to rename player image files based on the CSV mapping file.

## Files

- `rename_player_images.py` - Python script (recommended)
- `rename_player_images.js` - Node.js script
- `public/player_images/` - Directory containing player images

## CSV Format

The CSV file should have the following columns:
- `PlayerKey` - The new name for the file (without extension)
- `PlayerImage` - The current filename (with extension)

Example:
```csv
PlayerKey,PlayerImage
c__player__amjad_bhat__dbdcd,M3CTCm1E1897366921758773249.png
c__player__jay_davidson__001eb,4pT5NYA91733684773735501825.png
```

## Usage

### Python Script (Recommended)

```bash
# Make the script executable
chmod +x rename_player_images.py

# Run the script
python3 rename_player_images.py
```

### Node.js Script

First, install the required dependency:
```bash
npm install csv-parser
```

Then run the script:
```bash
node rename_player_images.js
```

## What the script does

1. Reads the CSV file from `/Users/ankitchawda/Downloads/playerNamesUpdated (1).csv`
2. For each row in the CSV:
   - Finds the file with the old name (PlayerImage) in `public/player_images/`
   - Renames it to the new name (PlayerKey) while preserving the file extension
3. Provides detailed output showing:
   - ✅ Successfully renamed files
   - ❌ Files not found in the directory
   - ⚠️ Files that already exist with the new name (skipped)
   - ❌ Any errors that occurred
4. Shows a summary at the end

## Safety Features

- **No overwriting**: If a file with the new name already exists, it will be skipped
- **Dry run option**: You can modify the script to do a dry run first
- **Detailed logging**: Every action is logged with its status

## Example Output

```
Starting player image rename process...

CSV File: /Users/ankitchawda/Downloads/playerNamesUpdated (1).csv
Images Directory: /Users/ankitchawda/Desktop/NGTS/wizplay/wizplay-monorepo/apps/match_service/public/player_images

Total mappings found: 1500

Starting file rename process...

[1] ✅ RENAMED: M3CTCm1E1897366921758773249.png → c__player__amjad_bhat__dbdcd.png
[2] ✅ RENAMED: 4pT5NYA91733684773735501825.png → c__player__jay_davidson__001eb.png
[3] ❌ NOT FOUND: some_missing_file.png
...

============================================================
SUMMARY
============================================================
Total files to process: 1500
✅ Successfully renamed: 1450
❌ Files not found: 30
❌ Errors: 0
⚠️  Skipped (already exists): 20
============================================================
```

## Troubleshooting

### CSV file not found
Make sure the CSV file path is correct in the script. Update this line if needed:
```python
CSV_FILE_PATH = '/Users/ankitchawda/Downloads/playerNamesUpdated (1).csv'
```

### Images directory not found
The script expects the images to be in `public/player_images/` relative to the script location.

### Permission errors
Run with appropriate permissions:
```bash
sudo python3 rename_player_images.py
```

## Reverting Changes

If you need to revert the changes, you can create a reverse CSV with the PlayerKey and PlayerImage columns swapped and run the script again.
