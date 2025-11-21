"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    
    return queryInterface.bulkInsert("auths", [
      {
        id:"83f3abb2-ce48-4974-b613-32f257e15d33",
        user_id: "f15d8f6f-29a5-48f3-bb44-1be9348a3b06",
        email: "admin@wizplay.com",
        phone_number: "+917795020428",
        provider: "local",
        password: "7abc92ea6c6b7d75676ac829d1d66e9a:16411a9e9ddc88f356ce93ecc3964ff88b6ed972e61dbd95b091baa24ad22412a1a66987ffa35d85fe89b9bce1eb8974a3c31affa77c49cdf84e85bb492f476b",
        otp_code: null,
        last_login_at: null,
        onboarded: true,
        otp_expires_at: null,
        type: "admin",
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('auths', {
      email: 'admin@wizplay.com'
    }, {});
  },
};