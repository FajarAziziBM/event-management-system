// migrations/20260709101010-add-reset-password-fields-to-users.js

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn(
      'users',
      'reset_password_token',
      {
        type: Sequelize.STRING,
        allowNull: true,
      }
    );


    await queryInterface.addColumn(
      'users',
      'reset_password_expires',
      {
        type: Sequelize.DATE,
        allowNull: true,
      }
    );

  },


  async down(queryInterface) {

    await queryInterface.removeColumn(
      'users',
      'reset_password_token'
    );


    await queryInterface.removeColumn(
      'users',
      'reset_password_expires'
    );

  }
};
