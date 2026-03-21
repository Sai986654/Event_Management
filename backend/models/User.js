const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: { notEmpty: { msg: 'Name is required' } },
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: { msg: 'Please enter a valid email' } },
    set(val) {
      this.setDataValue('email', val.toLowerCase());
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { len: { args: [6], msg: 'Password must be at least 6 characters' } },
  },
  role: {
    type: DataTypes.ENUM('admin', 'organizer', 'vendor', 'guest'),
    defaultValue: 'organizer',
  },
  phone: { type: DataTypes.STRING },
  avatar: { type: DataTypes.STRING },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true, field: 'is_active' },
}, {
  tableName: 'users',
  defaultScope: {
    attributes: { exclude: ['password'] },
  },
  scopes: {
    withPassword: { attributes: {} },
  },
});

// Hash password before create/update
User.beforeCreate(async (user) => {
  user.password = await bcrypt.hash(user.password, 12);
});
User.beforeUpdate(async (user) => {
  if (user.changed('password')) {
    user.password = await bcrypt.hash(user.password, 12);
  }
});

// Instance methods
User.prototype.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

User.prototype.generateToken = function () {
  return jwt.sign({ id: this.id, role: this.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

module.exports = User;
