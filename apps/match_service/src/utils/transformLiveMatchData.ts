type RawWebhook = any;
type CleanedMatch = any;

// --- helper: epoch -> ISO strings (UTC and IST)
  function toISOUTC(epochS?: number | null) {
    if (!epochS) return null;
    return new Date(epochS * 1000).toISOString();
  }
  
  function toISOIST(epochS?: number | null) {
    if (!epochS) return null;
    const d = new Date(epochS * 1000);
    const istMs = d.getTime() + 5.5 * 3600 * 1000;
    const ist = new Date(istMs);
    // produce simple ISO with +05:30 suffix
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      ist.getUTCFullYear() +
      "-" +
      pad(ist.getUTCMonth() + 1) +
      "-" +
      pad(ist.getUTCDate()) +
      "T" +
      pad(ist.getUTCHours()) +
      ":" +
      pad(ist.getUTCMinutes()) +
      ":" +
      pad(ist.getUTCSeconds()) +
      "+05:30"
    );
  }

// --- transform function (keeps payload small & predictable)
function transformMatch(raw: RawWebhook): CleanedMatch {
    const data = raw?.data || {};
    const play = data.play || {};
    const live = play.live || {};

    const inningsOrder: string[] = play.innings_order || [];
    const innings = inningsOrder.map((k) => {
        const inn = (play.innings && play.innings[k]) || {};
        return {
            id: inn.index || k,
            team: inn.index && inn.index.startsWith("a") ? "a" : "b",
            is_completed: !!inn.is_completed,
            overs: inn.overs || null,
            score_str: inn.score_str || null,
            runs: inn.score?.runs ?? null,
            wickets: inn.wickets ?? null,
            balls: inn.score?.balls ?? null,
        };
    });

    // top batters sweep (simple)
    const players = data.players || {};
    const top_batters: Record<string, any> = {};
    Object.entries(players).forEach(([pkey, p]: any) => {
        const name = p?.player?.name || null;
        const scoreBlocks = p?.score || {};
        Object.values(scoreBlocks).forEach((block: any) => {
            const batting = block?.batting?.score;
            if (!batting) return;
            const inn = batting.innings_index || "unknown";
            const runs = batting.runs || 0;
            if (!top_batters[inn] || runs > top_batters[inn].runs) {
                top_batters[inn] = {
                    player_key: pkey,
                    name,
                    runs,
                    balls: batting.balls || null,
                    fours: batting.fours || null,
                    sixes: batting.sixes || null,
                    strike_rate: batting.strike_rate || null,
                };
            }
        });
    });

    const cleaned = {
        match_id: data.key || null,
        title: data.title || data.name || null,
        short_name: data.short_name || null,
        subtitle: data.sub_title || null,
        status: data.status || null,
        play_status: data.play_status || null,
        start_at: {
            epoch_s: data.start_at || null,
            utc: toISOUTC(data.start_at),
            ist: toISOIST(data.start_at),
        },
        start_at_local: {
            epoch_s: data.start_at_local || null,
            utc: toISOUTC(data.start_at_local),
            ist: toISOIST(data.start_at_local),
        },
        tournament: {
            key: data.tournament?.key || null,
            name: data.tournament?.name || null,
        },
        teams: { a: data.teams?.a || null, b: data.teams?.b || null },
        venue: {
            name: data.venue?.name || null,
            city: data.venue?.city || null,
            country: data.venue?.country?.name || null,
            geolocation: data.venue?.geolocation || null,
        },
        toss: data.toss || null,
        target: play.target || null,
        innings,
        live: {
            current_innings: live.innings || null,
            batting_team: live.batting_team || null,
            bowling_team: live.bowling_team || null,
            score: live.score || null,
            required_score: live.required_score || null,
            striker: live.recent_players?.striker || null,
            non_striker: live.recent_players?.non_striker || null,
            bowler: live.recent_players?.bowler || null,
            recent_overs: live.recent_overs_repr || [],
            last_ball_key: live.last_ball_key || null,
            last_event_repr:
                (live.recent_overs_repr && live.recent_overs_repr[0]) || null,
        },
        top_batters,
        weather: data.weather || null,
        notes: data.notes || null,
        updated_at: {
            epoch_s: Math.floor(Date.now() / 1000),
            utc: new Date().toISOString(),
        },
        // include raw minimal identifiers for dedupe
        __meta: {
            last_ball_key: live.last_ball_key || null,
            last_score_epoch: live.score ? live.score?.epoch_s || null : null,
        },
    };

    return cleaned;
}

export default transformMatch