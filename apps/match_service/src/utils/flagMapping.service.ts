/**
 * Team Flag Mapping Utility
 * Maps team keys to their corresponding flag image filenames
 */

import * as path from 'path';
import * as fs from 'fs';

interface TeamFlagMapping {
  [teamKey: string]: string; // team key -> filename
}

class FlagMappingService {
  private static instance: FlagMappingService;
  private mapping: TeamFlagMapping = {};
  private isLoaded = false;

  private constructor() {}

  public static getInstance(): FlagMappingService {
    if (!FlagMappingService.instance) {
      FlagMappingService.instance = new FlagMappingService();
    }
    return FlagMappingService.instance;
  }

  /**
   * Load the CSV mapping file into memory
   */
  public loadMapping(): void {
    try {
      const csvPath = path.join(process.cwd(), 'public', 'flags', 'teamNamesUpdated.csv');
      
      if (!fs.existsSync(csvPath)) {
        console.warn(`[FLAG-MAPPING] CSV file not found at: ${csvPath}`);
        return;
      }

      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      const lines = csvContent.split('\n');
      
      // Skip header line
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const [teamKey, teamImage] = line.split(',').map(field => field.trim().replace(/^"|"$/g, ''));
        
        if (teamKey && teamImage) {
          // Extract extension from original image name
          const extension = path.extname(teamImage);
          // Create new filename: teamKey + extension
          const newFilename = `${teamKey}${extension}`;
          this.mapping[teamKey] = newFilename;
        }
      }

      this.isLoaded = true;
      console.log(`[FLAG-MAPPING] Loaded ${Object.keys(this.mapping).length} team flag mappings`);
      
    } catch (error) {
      console.error(`[FLAG-MAPPING] Error loading mapping: ${error}`);
    }
  }

  /**
   * Get the flag filename for a given team key
   * @param teamKey The team key (e.g., 'aus', 'ind', 'c__team__rcb__878bd')
   * @returns The flag filename (e.g., 'aus.png', 'ind.png', 'c__team__rcb__878bd.jpg')
   */
  public getFlagFilename(teamKey: string): string | null {
    if (!this.isLoaded) {
      this.loadMapping();
    }

    return this.mapping[teamKey] || null;
  }

  /**
   * Get the complete flag URL for a given team key
   * @param teamKey The team key
   * @param baseUrl The base URL for the asset service
   * @returns The complete flag URL or empty string if not found
   */
  public getFlagUrl(teamKey: string, baseUrl: string): string {
    const filename = this.getFlagFilename(teamKey);
    if (!filename) {
      console.warn(`[FLAG-MAPPING] No flag mapping found for team key: ${teamKey}`);
      return '';
    }

    return `${baseUrl}api/v1/matches/flags/${filename}`;
  }

  /**
   * Check if a flag exists for the given team key
   * @param teamKey The team key
   * @returns true if flag mapping exists
   */
  public hasFlagMapping(teamKey: string): boolean {
    if (!this.isLoaded) {
      this.loadMapping();
    }

    return teamKey in this.mapping;
  }

  /**
   * Get all available team keys
   * @returns Array of all team keys
   */
  public getAllTeamKeys(): string[] {
    if (!this.isLoaded) {
      this.loadMapping();
    }

    return Object.keys(this.mapping);
  }

  /**
   * Get mapping statistics
   */
  public getStats() {
    if (!this.isLoaded) {
      this.loadMapping();
    }

    return {
      totalMappings: Object.keys(this.mapping).length,
      isLoaded: this.isLoaded
    };
  }
}

export default FlagMappingService;