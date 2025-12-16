#!/usr/bin/env python3
import csv
import os
from pathlib import Path

# Paths configuration
CSV_FILE_PATH = '/Users/ankitchawda/Downloads/playerNamesUpdated (1).csv'
SCRIPT_DIR = Path(__file__).parent
IMAGES_DIR = SCRIPT_DIR / 'public' / 'player_images'

# Counters
success_count = 0
not_found_count = 0
error_count = 0
skipped_count = 0

print('Starting player image rename process...\n')
print(f'CSV File: {CSV_FILE_PATH}')
print(f'Images Directory: {IMAGES_DIR}\n')

# Check if directories exist
if not IMAGES_DIR.exists():
    print(f'❌ Error: Images directory does not exist: {IMAGES_DIR}')
    exit(1)

if not os.path.exists(CSV_FILE_PATH):
    print(f'❌ Error: CSV file does not exist: {CSV_FILE_PATH}')
    exit(1)

# Read CSV and process files
try:
    with open(CSV_FILE_PATH, 'r', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        file_mappings = []
        
        for row in reader:
            player_key = row.get('PlayerKey') or row.get('playerKey')
            player_image = row.get('PlayerImage') or row.get('playerImage')
            
            if player_key and player_image:
                file_mappings.append({
                    'old_name': player_image.strip(),
                    'new_name': player_key.strip()
                })
        
        print(f'Total mappings found: {len(file_mappings)}\n')
        print('Starting file rename process...\n')
        
        # Process each file
        for index, mapping in enumerate(file_mappings, 1):
            old_name = mapping['old_name']
            new_name = mapping['new_name']
            
            # Get file extension from old name
            ext = Path(old_name).suffix
            
            # Construct full paths
            old_path = IMAGES_DIR / old_name
            new_path = IMAGES_DIR / f'{new_name}{ext}'
            
            # Check if old file exists
            if not old_path.exists():
                print(f'[{index}] ❌ NOT FOUND: {old_name}')
                not_found_count += 1
                continue
            
            # Check if new file already exists
            if new_path.exists():
                print(f'[{index}] ⚠️  SKIPPED: {new_name}{ext} already exists')
                skipped_count += 1
                continue
            
            try:
                # Rename the file
                old_path.rename(new_path)
                print(f'[{index}] ✅ RENAMED: {old_name} → {new_name}{ext}')
                success_count += 1
            except Exception as e:
                print(f'[{index}] ❌ ERROR: {old_name} - {str(e)}')
                error_count += 1
        
        # Print summary
        print('\n' + '=' * 60)
        print('SUMMARY')
        print('=' * 60)
        print(f'Total files to process: {len(file_mappings)}')
        print(f'✅ Successfully renamed: {success_count}')
        print(f'❌ Files not found: {not_found_count}')
        print(f'❌ Errors: {error_count}')
        print(f'⚠️  Skipped (already exists): {skipped_count}')
        print('=' * 60)

except Exception as e:
    print(f'❌ Error reading CSV file: {str(e)}')
    exit(1)
