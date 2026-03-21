const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Booking = sequelize.define('Booking', {
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
  vendorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'vendor_id',
  },
  organizerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'organizer_id',
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'cancelled', 'completed'),
    defaultValue: 'pending',
  },
  price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  notes: { type: DataTypes.TEXT },
  serviceDate: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'service_date',
  },
}, {
  tableName: 'bookings',
  indexes: [
    { unique: true, fields: ['event_id', 'vendor_id'] },
  ],
});

module.exports = Booking;
