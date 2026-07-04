const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const {
  getMyProfile,
  updateMyProfile,
  updateMyLocation,
  addOfferTag,
  removeOfferTag,
  getPublicProfile,
} = require('../controllers/users.controller');

router.get('/me', requireAuth, getMyProfile);
router.put('/me', requireAuth, updateMyProfile);
router.post('/me/location', requireAuth, updateMyLocation);
router.post('/me/offer-tags', requireAuth, addOfferTag);
router.delete('/me/offer-tags/:id', requireAuth, removeOfferTag);
router.get('/:id', getPublicProfile);

module.exports = router;
