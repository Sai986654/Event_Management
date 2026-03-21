const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Review = sequelize.define('Review', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  vendorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'vendor_id',
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
  },
  eventId: {
    type: DataTypes.INTEGER,
    field: 'event_id',
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: { args: [1], msg: 'Rating must be at least 1' },
      max: { args: [5], msg: 'Rating must be at most 5' },
    },
  },
  comment: { type: DataTypes.TEXT },
}, {
  tableName: 'reviews',
  indexes: [
    { unique: true, fields: ['vendor_id', 'user_id'] },
  ],
});

module.exports = Review;
