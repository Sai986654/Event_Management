const { Prisma } = require('@prisma/client');

const errorHandler = (err, req, res, _next) => {
  console.error(err.stack);

  // Prisma known request error (unique constraint, not found, etc.)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const field = err.meta?.target?.[0] || 'field';
      return res
        .status(400)
        .json({ message: `Duplicate value for field: ${field}` });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Record not found' });
    }
    return res.status(400).json({ message: 'Database error' });
  }

  // Prisma validation error
  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({ message: 'Validation Error' });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: 'Invalid token' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Token expired' });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || 'Internal Server Error',
  });
};

module.exports = errorHandler;
