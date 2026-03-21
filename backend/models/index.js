// Re-export prisma client — models are generated from prisma/schema.prisma
const { prisma } = require('../config/db');
module.exports = { prisma };
