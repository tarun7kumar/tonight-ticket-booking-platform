const express = require('express');
const router = express.Router();
const { joinWaitlist, getMyWaitlist, acceptWaitlistOffer, leaveWaitlist } = require('../controllers/waitlist.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

// POST /api/waitlist/join — Customer joins waitlist
router.post('/join', authenticate, authorize('customer'), joinWaitlist);

// GET /api/waitlist/my — Customer's waitlist entries
router.get('/my', authenticate, authorize('customer'), getMyWaitlist);

// POST /api/waitlist/accept/:token — Accept waitlist offer (can also work without auth via token)
router.post('/accept/:token', acceptWaitlistOffer);

// DELETE /api/waitlist/:id — Customer leaves waitlist
router.delete('/:id', authenticate, authorize('customer'), leaveWaitlist);

module.exports = router;
