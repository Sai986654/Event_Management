const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const slugify = require('slugify');

const Event = sequelize.define('Event', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: { notEmpty: { msg: 'Event title is required' } },
  },
  slug: {
    type: DataTypes.STRING,
    unique: true,
  },
  type: {
    type: DataTypes.ENUM('wedding', 'corporate', 'birthday', 'conference', 'concert', 'other'),
    allowNull: false,
  },
  description: { type: DataTypes.TEXT },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  endDate: { type: DataTypes.DATE, field: 'end_date' },
  venue: { type: DataTypes.STRING, allowNull: false },
  address: { type: DataTypes.STRING },
  city: { type: DataTypes.STRING },
  state: { type: DataTypes.STRING },
  lat: { type: DataTypes.FLOAT },
  lng: { type: DataTypes.FLOAT },
  budget: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  guestCount: { type: DataTypes.INTEGER, defaultValue: 0, field: 'guest_count' },
  organizerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'organizer_id',
  },
  status: {
    type: DataTypes.ENUM('draft', 'planning', 'confirmed', 'ongoing', 'completed', 'cancelled'),
    defaultValue: 'draft',
  },
  coverImage: { type: DataTypes.STRING, field: 'cover_image' },
  isPublic: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_public' },
  timeline: { type: DataTypes.JSONB, defaultValue: [] },
  tasks: { type: DataTypes.JSONB, defaultValue: [] },
}, {
  tableName: 'events',
  indexes: [
    { fields: ['organizer_id', 'date'] },
    { fields: ['slug'], unique: true },
    { fields: ['status'] },
  ],
});

Event.beforeCreate((event) => {
  event.slug =
    slugify(event.title, { lower: true, strict: true }) +
    '-' +
    Date.now().toString(36);
});

Event.beforeUpdate((event) => {
  if (event.changed('title')) {
    event.slug =
      slugify(event.title, { lower: true, strict: true }) +
      '-' +
      Date.now().toString(36);
  }
});

module.exports = Event;
