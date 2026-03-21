const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Media = sequelize.define('Media', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  eventId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'event_id',
  },
  uploadedBy: {
    type: DataTypes.INTEGER,
    field: 'uploaded_by',
  },
  guestName: { type: DataTypes.STRING, field: 'guest_name' },
  url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  publicId: { type: DataTypes.STRING, field: 'public_id' },
  type: {
    type: DataTypes.ENUM('photo', 'video'),
    defaultValue: 'photo',
  },
  caption: { type: DataTypes.STRING(500) },
  isApproved: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_approved' },
  isFlagged: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_flagged' },
}, {
  tableName: 'media',
  indexes: [
    { fields: ['event_id'] },
  ],
});

module.exports = Media;
