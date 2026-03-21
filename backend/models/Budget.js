const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Budget = sequelize.define('Budget', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  eventId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    field: 'event_id',
  },
  totalBudget: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    field: 'total_budget',
  },
  guestCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'guest_count',
  },
  allocations: {
    type: DataTypes.JSONB,
    defaultValue: [],
  },
}, {
  tableName: 'budgets',
  indexes: [
    { unique: true, fields: ['event_id'] },
  ],
});

module.exports = Budget;
