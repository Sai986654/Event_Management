const router = require('express').Router();
const { getHomepageData } = require('../controllers/homepageController');

router.get('/', getHomepageData);

module.exports = router;
