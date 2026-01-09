"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    
    return queryInterface.bulkInsert("users", [
      {
        id:"6da07a13-b558-41ce-ad8f-80e8f96053ae",
        user_id: "f15d8f6f-29a5-48f3-bb44-1be9348a3b06",
        auth_id:"83f3abb2-ce48-4974-b613-32f257e15d33",
        user_name:"super_admin_007",
        name:"Praveen",
        onboarded:true,
        email: "admin@wizplay.com",
        phone_number: "+917795020428",
        type: "admin",
        status: "active",
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('users', {
      email: 'admin@wizplay.com'
    }, {});
  },
};