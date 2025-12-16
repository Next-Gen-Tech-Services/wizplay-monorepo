const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Paths configuration
const CSV_FILE_PATH = '/Users/ankitchawda/Downloads/playerNamesUpdated (1).csv';
const IMAGES_DIR = path.join(__dirname, 'public', 'player_images');

// Store the mapping from CSV
const fileMapping = [];
let successCount = 0;
let notFoundCount = 0;
let errorCount = 0;

console.log('Starting player image rename process...\n');
console.log(`CSV File: ${CSV_FILE_PATH}`);
console.log(`Images Directory: ${IMAGES_DIR}\n`);

// Read and parse CSV file
fs.createReadStream(CSV_FILE_PATH)
  .pipe(csv())
  .on('data', (row) => {
    // The CSV has columns: PlayerKey, PlayerImage
    const playerKey = row.PlayerKey || row.playerKey;
    const playerImage = row.PlayerImage || row.playerImage;
    
    if (playerKey && playerImage) {
      fileMapping.push({
        oldName: playerImage.trim(),
        newName: playerKey.trim()
      });
    }
  })
  .on('end', () => {
    console.log(`Total mappings found: ${fileMapping.length}\n`);
    console.log('Starting file rename process...\n');
    
    // Process each file
    fileMapping.forEach((mapping, index) => {
      const { oldName, newName } = mapping;
      
      // Get file extension from old name
      const ext = path.extname(oldName);
      
      // Construct full paths
      const oldPath = path.join(IMAGES_DIR, oldName);
      const newPath = path.join(IMAGES_DIR, newName + ext);
      
      // Check if old file exists
      if (!fs.existsSync(oldPath)) {
        console.log(`[${index + 1}] ❌ NOT FOUND: ${oldName}`);
        notFoundCount++;
        return;
      }
      
      // Check if new file already exists
      if (fs.existsSync(newPath)) {
        console.log(`[${index + 1}] ⚠️  SKIPPED: ${newName}${ext} already exists`);
        return;
      }
      
      try {
        // Rename the file
        fs.renameSync(oldPath, newPath);
        console.log(`[${index + 1}] ✅ RENAMED: ${oldName} → ${newName}${ext}`);
        successCount++;
      } catch (error) {
        console.log(`[${index + 1}] ❌ ERROR: ${oldName} - ${error.message}`);
        errorCount++;
      }
    });
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total files to process: ${fileMapping.length}`);
    console.log(`✅ Successfully renamed: ${successCount}`);
    console.log(`❌ Files not found: ${notFoundCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`⚠️  Skipped (already exists): ${fileMapping.length - successCount - notFoundCount - errorCount}`);
    console.log('='.repeat(60));
  })
  .on('error', (error) => {
    console.error('Error reading CSV file:', error.message);
    process.exit(1);
  });
