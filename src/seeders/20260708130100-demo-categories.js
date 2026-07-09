'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const categories = [
      ['Konser & Musik', 'Konser musik, gigs, dan pertunjukan live', 'music'],
      ['Workshop & Pelatihan', 'Kelas, workshop, dan pelatihan skill', 'graduation-cap'],
      ['Seminar & Konferensi', 'Seminar, konferensi, dan talkshow', 'presentation'],
      ['Olahraga', 'Turnamen, fun run, dan event olahraga lainnya', 'trophy'],
      ['Kuliner', 'Festival makanan, tasting, dan bazar kuliner', 'utensils'],
      ['Pameran & Expo', 'Pameran seni, expo produk, dan bazar', 'store'],
      ['Komunitas', 'Gathering komunitas & meetup', 'users'],
      ['Lainnya', 'Kategori umum untuk event yang tidak masuk kategori lain', 'ellipsis'],
    ].map(([name, description, icon]) => ({
      name,
      description,
      icon,
      created_at: now,
      updated_at: now,
    }));

    await queryInterface.bulkInsert('categories', categories);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('categories', null, {});
  },
};
