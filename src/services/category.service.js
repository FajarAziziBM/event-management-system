// src/services/category.service.js
'use strict';

const db = require('../models');
const { NotFoundError, ValidationError, ConflictError } = require('../utils/errors');

class CategoryService {
  /**
   * CAT-01: List semua kategori, diurut nama, dilengkapi jumlah event
   * per kategori (berguna bagi frontend untuk tahu kategori mana yang
   * "terpakai" sebelum mencoba hapus).
   */
  static async getAllCategories() {
    const categories = await db.Category.findAll({ order: [['name', 'ASC']] });

    const eventCounts = await db.Event.findAll({
      attributes: ['categoryId', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
      group: ['categoryId'],
      raw: true,
    });

    const countMap = {};
    eventCounts.forEach((row) => {
      countMap[row.categoryId] = parseInt(row.count, 10);
    });

    return categories.map((category) => ({
      ...category.toJSON(),
      eventCount: countMap[category.id] || 0,
    }));
  }

  static async getCategoryById(id) {
    const category = await db.Category.findByPk(id);
    if (!category) {
      throw new NotFoundError('Kategori tidak ditemukan');
    }
    return category;
  }

  /**
   * CAT-02 & CAT-05: Buat kategori baru — nama wajib & unik
   */
  static async createCategory({ name, description, icon }) {
    const existing = await db.Category.findOne({ where: { name } });
    if (existing) {
      throw new ValidationError('Nama kategori sudah digunakan', {
        name: 'Nama kategori sudah digunakan',
      });
    }

    const category = await db.Category.create({ name, description, icon });
    return category;
  }

  /**
   * CAT-03 & CAT-05: Edit kategori — nama tetap wajib unik (kecuali terhadap dirinya sendiri)
   */
  static async updateCategory(id, { name, description, icon }) {
    const category = await db.Category.findByPk(id);
    if (!category) {
      throw new NotFoundError('Kategori tidak ditemukan');
    }

    if (name && name !== category.name) {
      const existing = await db.Category.findOne({ where: { name } });
      if (existing) {
        throw new ValidationError('Nama kategori sudah digunakan', {
          name: 'Nama kategori sudah digunakan',
        });
      }
    }

    await category.update({
      name: name ?? category.name,
      description: description !== undefined ? description : category.description,
      icon: icon !== undefined ? icon : category.icon,
    });

    return category;
  }

  /**
   * CAT-04: Hapus kategori — guard bila masih dipakai oleh event manapun
   */
  static async deleteCategory(id) {
    const category = await db.Category.findByPk(id);
    if (!category) {
      throw new NotFoundError('Kategori tidak ditemukan');
    }

    const eventCount = await db.Event.count({ where: { categoryId: id } });
    if (eventCount > 0) {
      throw new ConflictError(
        `Kategori masih dipakai oleh ${eventCount} event dan tidak bisa dihapus`,
        { eventCount },
      );
    }

    await category.destroy();
    return { id: category.id, name: category.name };
  }
}

module.exports = CategoryService;
