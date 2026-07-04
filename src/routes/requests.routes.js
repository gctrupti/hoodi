const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const {
  createRequest,
  listRequests,
  getRequestById,
  acceptRequest,
  updateStatus,
  deleteRequest,
} = require('../controllers/requests.controller');

router.post('/', requireAuth, createRequest);
router.get('/', requireAuth, listRequests);
router.get('/:id', requireAuth, getRequestById);
router.patch('/:id/accept', requireAuth, acceptRequest);
router.patch('/:id/status', requireAuth, updateStatus);
router.delete('/:id', requireAuth, deleteRequest);

module.exports = router;
