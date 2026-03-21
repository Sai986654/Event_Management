const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Guest = sequelize.define('Guest', {
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
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { notEmpty: { msg: 'Guest name is required' } },
  },
  email: {
    type: DataTypes.STRING,
    validate: { isEmail: { msg: 'Please enter a valid email' } },
    set(val) {
      if (val) this.setDataValue('email', val.toLowerCase());
    },
  },
  phone: { type: DataTypes.STRING },
  rsvpStatus: {
    type: DataTypes.ENUM('pending', 'accepted', 'declined', 'maybe'),
    defaultValue: 'pending',
    field: 'rsvp_status',
  },
  plusOnes: { type: DataTypes.INTEGER, defaultValue: 0, field: 'plus_ones' },
  dietaryPreferences: { type: DataTypes.STRING, field: 'dietary_preferences' },
  tableAssignment: { type: DataTypes.STRING, field: 'table_assignment' },
  qrCode: { type: DataTypes.TEXT, field: 'qr_code' },
  checkedIn: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'checked_in' },
  checkedInAt: { type: DataTypes.DATE, field: 'checked_in_at' },
}, {
  tableName: 'guests',
  indexes: [
    { fields: ['event_id'] },
    { fields: ['event_id', 'email'] },
  ],
});

module.exports = Guest;
