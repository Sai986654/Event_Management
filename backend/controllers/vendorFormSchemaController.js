const asyncHandler = require('../utils/asyncHandler');
const { getVendorFormSchema } = require('../services/vendorFormSchemaService');

exports.getPublicVendorFormSchema = asyncHandler(async (_req, res) => {
  const schema = await getVendorFormSchema();
  res.json(schema);
});
