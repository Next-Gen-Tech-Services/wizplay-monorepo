import { logger } from "@repo/common";
import { randomUUID } from "node:crypto";
import { IMatchAttrs } from "../dtos/match.dto";
import { ITournamentAtters } from "../dtos/tournament.dto";
import { IMatch, IScheduleResponse } from "../interfaces/match";

export function extractMatches(data: IScheduleResponse): any {
  try {
    let daysData = data?.days;
    let allMatches: any[] = [];
    if (!daysData.length) {
      throw new Error("invalid days data length");
    }

    // Extract all matches
    for (let i = 0; i < daysData.length; i++) {
      const matches = daysData[i]?.matches;
      allMatches = [...allMatches, ...matches];
    }
    return allMatches;
  } catch (error: any) {
    logger.info(error.message);
  }
}

export function formatMatchData(data: IMatch[]): any {
  try {
    const allMatches = [];
    const allTournaments: any = {};
    if (!data.length) {
      throw new Error("invalid match data length");
    }

    for (let i = 0; i < data.length; i++) {
      let currMatch = data[i];
      let tempMatchObject: IMatchAttrs = {
        id: randomUUID(),
        key: currMatch.key,
        name: currMatch.name,
        shortName: currMatch.short_name,
        subTitle: currMatch.sub_title,
        sport: currMatch.sport,
        winner: currMatch.winner,
        tournamentKey: currMatch.tournament.key || currMatch.tour_key,
        format: currMatch.format,
        gender: currMatch.gender,
        status: currMatch.status,
        metricGroup: currMatch.metric_group,
        teams: currMatch.teams ?? null,
        startedAt: currMatch.start_at,
        endedAt: currMatch.completed_date_approximate,
        expectedEndedAt: currMatch.estimated_end_date,
        expectedStartedAt: currMatch.expected_start_at,
      };
      allMatches.push(tempMatchObject);

      if (Object.keys(currMatch.tournament).length) {
        let tempTourObject: ITournamentAtters = {
          id: randomUUID(),
          key: currMatch.tournament.key,
          name: currMatch.tournament.name,
          shortName: currMatch?.tournament?.short_name,
          alternateName: currMatch?.tournament?.alternate_name,
          alternateShortName: currMatch?.tournament?.alternate_short_name,
        };
        allTournaments[currMatch?.tournament?.key] = tempTourObject;
      }
    }

    return {
      matches: allMatches,
      tournaments: Object.values(allTournaments),
    };
  } catch (error: any) {
    logger.info(error.message);
  }
}
