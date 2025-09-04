"use strict";
const path = require("path");
const fs = require("fs");

module.exports = {
  async up(queryInterface) {
    const file = path.resolve(process.cwd(), "data/matches.json");
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));

    const rows = raw.map((m) => ({
      match_key: m.match_key,
      name: m.name,
      short_name: m.short_name,
      tournament_key: m.tournament_key || null,
      status: m.status || null,
      start_at: new Date((m.start_at || 0) * 1000),
      metric_group: m.metric_group || null,
      format: m.format || null,
      venue_name: m.venue_name || null,
      team_a: m.team_a || null,
      team_b: m.team_b || null,
      result_msg: m.result_msg || null,
      raw_json: JSON.stringify(m.raw || {}),
      created_at: new Date(),
      updated_at: new Date(),
    }));

    await queryInterface.bulkInsert("matches", rows, {});
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("matches", null, {});
  },
};
