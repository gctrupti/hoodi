const pool = require('../db/pool');
const { categorizeRequest, VALID_CATEGORIES, VALID_URGENCY } = require('../services/ai.service');

// POST /api/requests
async function createRequest(req, res) {
  const { title, description, category, urgency, lat, lng, addressText, photoUrl } = req.body;

  if (!title || !description || typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'title, description, lat, and lng are required' });
  }

  try {
    // Run AI categorization - this suggests values, but the user's own
    // choice (if provided) always takes priority over the AI's guess.
    const aiResult = await categorizeRequest(title, description);

    const finalCategory = VALID_CATEGORIES.includes(category) ? category : aiResult.category;
    const finalUrgency = VALID_URGENCY.includes(urgency) ? urgency : aiResult.urgency;

    const result = await pool.query(
      `INSERT INTO help_requests (
         requester_id, title, description, category, urgency,
         ai_suggested_category, ai_suggested_urgency, ai_confidence,
         photo_url, location, address_text
       )
       VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8,
         $9, ST_SetSRID(ST_MakePoint($10, $11), 4326)::geography, $12
       )
       RETURNING id, title, description, category, urgency, status, created_at`,
      [
        req.userId, title, description, finalCategory, finalUrgency,
        aiResult.category, aiResult.urgency, aiResult.confidence,
        photoUrl || null, lng, lat, addressText || null,
      ]
    );

    res.status(201).json({ request: result.rows[0], aiSuggestion: aiResult });
  } catch (err) {
    console.error('Create request error:', err);
    res.status(500).json({ error: 'Something went wrong creating your request' });
  }
}

// GET /api/requests?lat=..&lng=..&radius=5000&category=..&urgency=..
async function listRequests(req, res) {
  const { lat, lng, radius, category, urgency } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng query params are required' });
  }

  const radiusMeters = radius ? parseFloat(radius) : 5000; // default 5km

  const conditions = ["status = 'open'"];
  const params = [parseFloat(lng), parseFloat(lat), radiusMeters];

  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }
  if (urgency) {
    params.push(urgency);
    conditions.push(`urgency = $${params.length}`);
  }

  try {
    const result = await pool.query(
      `SELECT
         hr.id, hr.title, hr.description, hr.category, hr.urgency, hr.status,
         hr.address_text, hr.photo_url, hr.created_at,
         u.id AS requester_id, u.name AS requester_name,
         ST_Y(hr.location::geometry) AS lat, ST_X(hr.location::geometry) AS lng,
         ROUND((ST_Distance(hr.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000)::numeric, 2) AS distance_km
       FROM help_requests hr
       JOIN users u ON u.id = hr.requester_id
       WHERE ${conditions.join(' AND ')}
         AND ST_DWithin(hr.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
       ORDER BY
         CASE hr.urgency WHEN 'emergency' THEN 0 WHEN 'today' THEN 1 ELSE 2 END,
         distance_km ASC`,
      params
    );

    res.json({ requests: result.rows });
  } catch (err) {
    console.error('List requests error:', err);
    res.status(500).json({ error: 'Something went wrong fetching nearby requests' });
  }
}

// GET /api/requests/:id
async function getRequestById(req, res) {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT
         hr.*, ST_Y(hr.location::geometry) AS lat, ST_X(hr.location::geometry) AS lng,
         requester.name AS requester_name, requester.profile_photo_url AS requester_photo,
         helper.name AS helper_name
       FROM help_requests hr
       JOIN users requester ON requester.id = hr.requester_id
       LEFT JOIN users helper ON helper.id = hr.helper_id
       WHERE hr.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json({ request: result.rows[0] });
  } catch (err) {
    console.error('Get request error:', err);
    res.status(500).json({ error: 'Something went wrong fetching this request' });
  }
}

// PATCH /api/requests/:id/accept
async function acceptRequest(req, res) {
  const { id } = req.params;

  try {
    const existing = await pool.query('SELECT requester_id, status FROM help_requests WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }
    if (existing.rows[0].requester_id === req.userId) {
      return res.status(400).json({ error: 'You cannot accept your own request' });
    }
    if (existing.rows[0].status !== 'open') {
      return res.status(409).json({ error: 'This request is no longer open' });
    }

    const result = await pool.query(
      `UPDATE help_requests
       SET helper_id = $1, status = 'accepted', accepted_at = NOW()
       WHERE id = $2 AND status = 'open'
       RETURNING id, status, helper_id, accepted_at`,
      [req.userId, id]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'This request was just accepted by someone else' });
    }

    // Create a chat thread automatically once accepted
    await pool.query(
      `INSERT INTO chat_threads (request_id) VALUES ($1) ON CONFLICT (request_id) DO NOTHING`,
      [id]
    );

    await pool.query(
      `INSERT INTO request_status_history (request_id, old_status, new_status, changed_by)
       VALUES ($1, 'open', 'accepted', $2)`,
      [id, req.userId]
    );

    res.json({ request: result.rows[0] });
  } catch (err) {
    console.error('Accept request error:', err);
    res.status(500).json({ error: 'Something went wrong accepting this request' });
  }
}

// PATCH /api/requests/:id/status
async function updateStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  const validTransitions = ['in_progress', 'completed', 'cancelled'];
  if (!validTransitions.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validTransitions.join(', ')}` });
  }

  try {
    const existing = await pool.query(
      'SELECT requester_id, helper_id, status FROM help_requests WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const { requester_id, helper_id } = existing.rows[0];
    if (req.userId !== requester_id && req.userId !== helper_id) {
      return res.status(403).json({ error: 'You are not part of this request' });
    }

    const timestampColumn = status === 'completed' ? 'completed_at'
      : status === 'cancelled' ? 'cancelled_at' : null;

    const setClause = timestampColumn
      ? `status = $1, ${timestampColumn} = NOW()`
      : `status = $1`;

    const result = await pool.query(
      `UPDATE help_requests SET ${setClause} WHERE id = $2 RETURNING id, status`,
      [status, id]
    );

    await pool.query(
      `INSERT INTO request_status_history (request_id, old_status, new_status, changed_by)
       VALUES ($1, $2, $3, $4)`,
      [id, existing.rows[0].status, status, req.userId]
    );

    res.json({ request: result.rows[0] });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Something went wrong updating the status' });
  }
}

// DELETE /api/requests/:id
async function deleteRequest(req, res) {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM help_requests WHERE id = $1 AND requester_id = $2 AND status = 'open' RETURNING id`,
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found, not yours, or already in progress' });
    }

    res.json({ message: 'Request deleted' });
  } catch (err) {
    console.error('Delete request error:', err);
    res.status(500).json({ error: 'Something went wrong deleting this request' });
  }
}

module.exports = {
  createRequest,
  listRequests,
  getRequestById,
  acceptRequest,
  updateStatus,
  deleteRequest,
};
