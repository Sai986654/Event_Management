const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Vendor = sequelize.define('Vendor', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
  },
  businessName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'business_name',
    validate: { notEmpty: { msg: 'Business name is required' } },
  },
  category: {
    type: DataTypes.ENUM(
      'catering', 'decor', 'photography', 'videography',
      'music', 'venue', 'florist', 'transportation', 'other'
    ),
    allowNull: false,
  },
  description: { type: DataTypes.TEXT },
  basePrice: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0, field: 'base_price' },
  currency: { type: DataTypes.STRING(10), defaultValue: 'INR' },
  priceType: {
    type: DataTypes.ENUM('fixed', 'per-person', 'hourly', 'custom'),
    defaultValue: 'fixed',
    field: 'price_type',
  },
  portfolio: { type: DataTypes.JSONB, defaultValue: [] },
  availability: { type: DataTypes.JSONB, defaultValue: [] },
  city: { type: DataTypes.STRING },
  state: { type: DataTypes.STRING },
  contactPhone: { type: DataTypes.STRING, field: 'contact_phone' },
  contactEmail: { type: DataTypes.STRING, field: 'contact_email' },
  website: { type: DataTypes.STRING },
  averageRating: { type: DataTypes.DECIMAL(2, 1), defaultValue: 0, field: 'average_rating' },
  totalReviews: { type: DataTypes.INTEGER, defaultValue: 0, field: 'total_reviews' },
  isVerified: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_verified' },
}, {
  tableName: 'vendors',
  indexes: [
    { fields: ['category'] },
    { fields: ['city'] },
    { fields: ['average_rating'] },
  ],
});

module.exports = Vendor;
