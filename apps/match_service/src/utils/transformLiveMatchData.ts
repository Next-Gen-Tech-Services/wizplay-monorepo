type RawMatchData = any;

interface SimplifiedMatch {
  match: MatchInfo;
  teams: TeamsInfo;
  innings: InningsData[];
  live: LiveData | null;
  toss: TossInfo | null;
  extras: ExtrasInfo;
  fallOfWickets: FallOfWicket[];
}

interface MatchInfo {
  id: string;
  title: string;
  shortName: string;
  subtitle: string;
  status: string;
  playStatus: string;
  format: string;
  venue: { name: string; city: string; country: string };
  startTime: { epoch: number; utc: string; ist: string };
  tournament: { key: string; name: string };
  weather: string;
}

interface TeamsInfo {
  a: TeamData;
  b: TeamData;
}

interface TeamData {
  key: string;
  name: string;
  code: string;
  totalScore?: string;
  totalOvers?: string;
}

interface InningsData {
  id: string;
  team: string;
  teamName: string;
  teamCode: string;
  innings_number: number;
  completed: boolean;
  score: { runs: number; wickets: number; overs: string; balls: number; runRate: number; extras: number };
  batting: BattingStats[];
  bowling: BowlingStats[];
  partnerships: Partnership[];
}

interface BattingStats {
  key: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  dotBalls: number;
  dismissal: string | null;
  isOut: boolean;
  position: number;
}

interface BowlingStats {
  key: string;
  name: string;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  dotBalls: number;
  wides: number;
  noBalls: number;
}

interface Partnership {
  runs: number;
  balls: number;
  runRate: number;
  player1: { name: string; runs: number; balls: number };
  player2: { name: string; runs: number; balls: number };
  completed: boolean;
}

interface LiveData {
  innings: string;
  battingTeam: string;
  bowlingTeam: string;
  currentScore: { runs: number; wickets: number; overs: string; runRate: number; display: string };
  requiredScore: any;
  target: any;
  striker: PlayerLive;
  nonStriker: PlayerLive;
  bowler: BowlerLive;
  recentOvers: RecentOver[];
  lastBallKey: string;
  commentary: CommentaryItem[];
}

interface PlayerLive {
  key: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
}

interface BowlerLive {
  key: string;
  name: string;
  overs: string;
  runs: number;
  wickets: number;
  economy: number;
}

interface RecentOver {
  overNumber: number;
  balls: string[];
  ballDetails: BallDetail[];
}

interface BallDetail {
  repr: string;
  runs: number;
  isWicket: boolean;
  isBoundary: boolean;
  isExtra: boolean;
}

interface CommentaryItem {
  over: string;
  ballKey: string;
  repr: string;
  text: string;
  batsman?: string;
  bowler?: string;
}

interface TossInfo {
  winner: string;
  winnerName: string;
  decision: string;
}

interface ExtrasInfo {
  [innings: string]: { total: number; byes: number; legByes: number; wides: number; noBalls: number; penalties: number };
}

interface FallOfWicket {
  innings: string;
  wicketNumber: number;
  runs: number;
  overs: string;
  playerOut: string;
  dismissal: string;
}

function toISOUTC(epochS?: number | null): string | null {
  if (!epochS) return null;
  return new Date(epochS * 1000).toISOString();
}

function toISOIST(epochS?: number | null): string | null {
  if (!epochS) return null;
  const d = new Date(epochS * 1000);
  const istMs = d.getTime() + 5.5 * 3600 * 1000;
  const ist = new Date(istMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}T${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}:${pad(ist.getUTCSeconds())}+05:30`;
}

function formatOvers(overs: number[]): string {
  if (!overs || overs.length !== 2) return "0.0";
  return `${overs[0]}.${overs[1]}`;
}

function parseBallRepr(reprRaw: string): BallDetail {
  const repr = reprRaw.toLowerCase().trim();
  if (repr.includes(",")) {
    const [prefix, flag] = repr.split(",");
    const extraRuns = prefix.startsWith("e") ? parseInt(prefix.slice(1)) || 0 : 0;
    const isWide = flag === "wd";
    const isNoBall = flag === "nb";
    const isLegBye = flag === "lb";
    const isBye = flag === "b";
    return {
      repr: reprRaw,
      runs: extraRuns,
      isWicket: false,
      isBoundary: false,
      isExtra: isWide || isNoBall || isLegBye || isBye
    };
  }
  const isBoundary4 = repr === "b4";
  const isBoundary6 = repr === "b6";
  const isWicket = repr === "w";
  const isWide = repr.startsWith("wd");
  const isNoBall = repr.startsWith("nb");
  const isLegBye = repr.startsWith("lb");
  const isBye = /^b(?![46])\d*$/.test(repr);
  const runs =
    repr.startsWith("r") ? parseInt(repr.slice(1)) || 0 :
    isBoundary4 ? 4 :
    isBoundary6 ? 6 :
    isWide ? (parseInt(repr.slice(2)) || 1) :
    isNoBall ? (parseInt(repr.slice(2)) || 1) :
    isLegBye ? (parseInt(repr.slice(2)) || 0) :
    isBye ? (parseInt(repr.slice(1)) || 0) :
    0;
  return { repr: reprRaw, runs, isWicket, isBoundary: isBoundary4 || isBoundary6, isExtra: isWide || isNoBall || isLegBye || isBye };
}

export function transformCricketMatch(raw: RawMatchData): SimplifiedMatch {
  const data = raw?.data || {};
  const play = data.play || {};
  const live = play.live || {};
  const innings = play.innings || {};
  const players = data.players || {};

  const matchInfo: MatchInfo = {
    id: data.key || "",
    title: data.name || "",
    shortName: data.short_name || "",
    subtitle: data.sub_title || "",
    status: data.status || "",
    playStatus: data.play_status || "",
    format: data.format || "",
    venue: { name: data.venue?.name || "", city: data.venue?.city || "", country: data.venue?.country?.name || "" },
    startTime: { epoch: data.start_at || 0, utc: toISOUTC(data.start_at) || "", ist: toISOIST(data.start_at) || "" },
    tournament: { key: data.tournament?.key || "", name: data.tournament?.name || "" },
    weather: data.weather || ""
  };

  const teamsInfo: TeamsInfo = {
    a: { key: data.teams?.a?.key || "", name: data.teams?.a?.name || "", code: data.teams?.a?.code || "" },
    b: { key: data.teams?.b?.key || "", name: data.teams?.b?.name || "", code: data.teams?.b?.code || "" }
  };

  const tossInfo: TossInfo | null = data.toss ? { winner: data.toss.winner || "", winnerName: data.teams?.[data.toss.winner]?.name || "", decision: data.toss.elected || "" } : null;

  const inningsOrder = play.innings_order || [];
  const inningsData: InningsData[] = [];
  const extrasInfo: ExtrasInfo = {};
  const fallOfWickets: FallOfWicket[] = [];

  inningsOrder.forEach((innKey: string, index: number) => {
    const inn = innings[innKey];
    if (!inn) return;
    const teamKey = innKey.split("_")[0];
    const teamData = data.teams?.[teamKey];

    const battingStats: BattingStats[] = [];
    (inn.batting_order || []).forEach((playerKey: string, idx: number) => {
      const player = players[playerKey];
      if (!player) return;
      const score = player.score?.["1"]?.batting?.score;
      const dismissal = player.score?.["1"]?.batting?.dismissal;
      if (score) {
        battingStats.push({
          key: playerKey,
          name: player.player?.name || "",
          runs: score.runs || 0,
          balls: score.balls || 0,
          fours: score.fours || 0,
          sixes: score.sixes || 0,
          strikeRate: score.strike_rate || 0,
          dotBalls: score.dot_balls || 0,
          dismissal: dismissal?.msg || null,
          isOut: !!dismissal,
          position: idx + 1
        });
        if (dismissal) {
          fallOfWickets.push({
            innings: innKey,
            wicketNumber: dismissal.wicket_number || 0,
            runs: dismissal.team_runs || 0,
            overs: formatOvers(dismissal.overs),
            playerOut: player.player?.name || "",
            dismissal: dismissal.msg || ""
          });
        }
      }
    });

    const bowlingStats: BowlingStats[] = [];
    Object.keys(players).forEach((playerKey) => {
      const player = players[playerKey];
      const bowlingScore = player?.score?.["1"]?.bowling?.score;
      if (bowlingScore && bowlingScore.balls > 0) {
        bowlingStats.push({
          key: playerKey,
          name: player.player?.name || "",
          overs: formatOvers(bowlingScore.overs),
          maidens: bowlingScore.maiden_overs || 0,
          runs: bowlingScore.runs || 0,
          wickets: bowlingScore.wickets || 0,
          economy: bowlingScore.economy || 0,
          dotBalls: bowlingScore.balls_breakup?.dot_balls || 0,
          wides: bowlingScore.balls_breakup?.wides || 0,
          noBalls: bowlingScore.balls_breakup?.no_balls || 0
        });
      }
    });

    bowlingStats.sort((a, b) => (b.wickets !== a.wickets ? b.wickets - a.wickets : a.economy - b.economy));

    const partnerships: Partnership[] = (inn.partnerships || []).map((p: any) => ({
      runs: p.score?.runs || 0,
      balls: p.score?.balls || 0,
      runRate: p.score?.run_rate || 0,
      player1: { name: players[p.player_a_key]?.player?.name || "", runs: p.player_a_score?.runs || 0, balls: p.player_a_score?.balls || 0 },
      player2: { name: players[p.player_b_key]?.player?.name || "", runs: p.player_b_score?.runs || 0, balls: p.player_b_score?.balls || 0 },
      completed: p.is_completed || false
    }));

    extrasInfo[innKey] = {
      total: inn.extra_runs?.extra || 0,
      byes: inn.extra_runs?.bye || 0,
      legByes: inn.extra_runs?.leg_bye || 0,
      wides: inn.extra_runs?.wide || 0,
      noBalls: inn.extra_runs?.no_ball || 0,
      penalties: inn.extra_runs?.penalty || 0
    };

    inningsData.push({
      id: innKey,
      team: teamKey,
      teamName: teamData?.name || "",
      teamCode: teamData?.code || "",
      innings_number: index + 1,
      completed: inn.is_completed || false,
      score: { runs: inn.score?.runs || 0, wickets: inn.wickets || 0, overs: formatOvers(inn.overs), balls: inn.score?.balls || 0, runRate: inn.score?.run_rate || 0, extras: inn.extra_runs?.extra || 0 },
      batting: battingStats,
      bowling: bowlingStats,
      partnerships
    });
  });

  const recentOvers = (live.recent_overs_repr || []).map((over: any) => ({
    overNumber: over.overnumber,
    balls: over.ball_repr || [],
    ballDetails: (over.ball_repr || []).map(parseBallRepr)
  }));

  const relatedBalls = play.related_balls || {};
  const recentOversWithKeys = (live.recent_overs || []).map((o: any) => ({ overnumber: o.overnumber, ball_keys: o.ball_keys || [] }));
  const commentary: CommentaryItem[] = [];
  for (const o of recentOversWithKeys) {
    o.ball_keys.forEach((bk: string, idx: number) => {
      const rb = relatedBalls[bk];
      if (!rb) return;
      commentary.push({
        over: `${o.overnumber}.${idx + 1}`,
        ballKey: bk,
        repr: String(rb.repr || ""),
        text: String(rb.comment || ""),
        batsman: rb.batsman?.player_key ? players[rb.batsman.player_key]?.player?.name : undefined,
        bowler: rb.bowler?.player_key ? players[rb.bowler.player_key]?.player?.name : undefined
      });
    });
  }

  const liveData: LiveData | null = live.score
    ? {
        innings: live.innings || "",
        battingTeam: data.teams?.[live.batting_team]?.name || "",
        bowlingTeam: data.teams?.[live.bowling_team]?.name || "",
        currentScore: { runs: live.score.runs || 0, wickets: live.score.wickets || 0, overs: formatOvers(live.score.overs), runRate: live.score.run_rate || 0, display: live.score.title || "" },
        requiredScore: live.required_score,
        target: play.target,
        striker: {
          key: live.recent_players?.striker?.key || "",
          name: live.recent_players?.striker?.name || "",
          runs: live.recent_players?.striker?.stats?.runs || 0,
          balls: live.recent_players?.striker?.stats?.balls || 0,
          fours: live.recent_players?.striker?.stats?.fours || 0,
          sixes: live.recent_players?.striker?.stats?.sixes || 0,
          strikeRate: live.recent_players?.striker?.stats?.strike_rate || 0
        },
        nonStriker: {
          key: live.recent_players?.non_striker?.key || "",
          name: live.recent_players?.non_striker?.name || "",
          runs: live.recent_players?.non_striker?.stats?.runs || 0,
          balls: live.recent_players?.non_striker?.stats?.balls || 0,
          fours: live.recent_players?.non_striker?.stats?.fours || 0,
          sixes: live.recent_players?.non_striker?.stats?.sixes || 0,
          strikeRate: live.recent_players?.non_striker?.stats?.strike_rate || 0
        },
        bowler: {
          key: live.recent_players?.bowler?.key || "",
          name: live.recent_players?.bowler?.name || "",
          overs: formatOvers(live.recent_players?.bowler?.stats?.overs),
          runs: live.recent_players?.bowler?.stats?.runs || 0,
          wickets: live.recent_players?.bowler?.stats?.wickets || 0,
          economy: live.recent_players?.bowler?.stats?.economy || 0
        },
        recentOvers,
        lastBallKey: live.last_ball_key || "",
        commentary : commentary.reverse()
      }
    : null;

  fallOfWickets.sort((a, b) => a.wicketNumber - b.wicketNumber);

  return { match: matchInfo, teams: teamsInfo, innings: inningsData, live: liveData, toss: tossInfo, extras: extrasInfo, fallOfWickets };
}

export function getScorecard(transformedData: SimplifiedMatch, inningsId?: string) {
  if (inningsId) return transformedData.innings.find((inn) => inn.id === inningsId);
  return transformedData.innings;
}

export function getLiveScore(transformedData: SimplifiedMatch) {
  return transformedData.live;
}

export function getTopBatsmen(transformedData: SimplifiedMatch, limit: number = 5) {
  const allBatsmen = transformedData.innings.flatMap((inn) => inn.batting);
  return allBatsmen.sort((a, b) => b.runs - a.runs).slice(0, limit);
}

export function getTopBowlers(transformedData: SimplifiedMatch, limit: number = 5) {
  const allBowlers = transformedData.innings.flatMap((inn) => inn.bowling);
  return allBowlers.sort((a, b) => (b.wickets !== a.wickets ? b.wickets - a.wickets : a.economy - b.economy)).slice(0, limit);
}

export function getMatchSummary(transformedData: SimplifiedMatch) {
  return {
    match: transformedData.match,
    teams: transformedData.teams,
    toss: transformedData.toss,
    scores: transformedData.innings.map((inn) => ({ team: inn.teamName, score: `${inn.score.runs}/${inn.score.wickets}`, overs: inn.score.overs, runRate: inn.score.runRate })),
    live: transformedData.live ? { battingTeam: transformedData.live.battingTeam, score: transformedData.live.currentScore.display } : null
  };
}
