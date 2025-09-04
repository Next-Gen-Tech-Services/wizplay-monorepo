"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("matches", {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },

      match_key: { type: Sequelize.STRING, allowNull: false, unique: true },
      name: { type: Sequelize.STRING },
      short_name: { type: Sequelize.STRING },

      tournament_key: { type: Sequelize.STRING },
      metric_group: { type: Sequelize.STRING },
      format: { type: Sequelize.STRING },

      venue_name: { type: Sequelize.STRING },

      team_a: { type: Sequelize.STRING },
      team_b: { type: Sequelize.STRING },

      status: { type: Sequelize.STRING },
      result_msg: { type: Sequelize.STRING },

      start_at: { type: Sequelize.DATE },

      raw_json: { type: Sequelize.JSONB },

      display_on_frontend: { type: Sequelize.BOOLEAN, defaultValue: false },
      contests_generated: { type: Sequelize.BOOLEAN, defaultValue: false },
      contests_updated_at: { type: Sequelize.DATE, allowNull: true },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });

    await queryInterface.addIndex("matches", ["match_key"], {
      unique: true,
      name: "idx_matches_match_key",
    });
    await queryInterface.addIndex("matches", ["tournament_key"], {
      name: "idx_matches_tournament_key",
    });
    await queryInterface.addIndex("matches", ["status"], {
      name: "idx_matches_status",
    });
    await queryInterface.addIndex("matches", ["start_at"], {
      name: "idx_matches_start_at",
    });
    await queryInterface.addIndex("matches", ["team_a"], {
      name: "idx_matches_team_a",
    });
    await queryInterface.addIndex("matches", ["team_b"], {
      name: "idx_matches_team_b",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("matches");
  },
};
