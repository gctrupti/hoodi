const pool = require('../db/pool');

// GET /api/users/me  (already have a similar route in auth, this is the fuller version)
async function getMyProfile(req, res) {
  try {
    const userResult = await pool.query(
      `SELECT id, name, email, phone_number, phone_verified, bio, profile_photo_url,
              ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
              created_at
       FROM users WHERE id = $1`,
      [req.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const tagsResult = await pool.query(
      'SELECT id, tag FROM user_offer_tags WHERE user_id = $1 ORDER BY created_at',
      [req.userId]
    );

    res.json({ user: userResult.rows[0], offerTags: tagsResult.rows });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Something went wrong fetching your profile' });
  }
}

// PUT /api/users/me
async function updateMyProfile(req, res) {
  const { name, bio, profilePhotoUrl } = req.body;

  try {
    const result = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           bio = COALESCE($2, bio),
           profile_photo_url = COALESCE($3, profile_photo_url)
       WHERE id = $4
       RETURNING id, name, email, bio, profile_photo_url`,
      [name, bio, profilePhotoUrl, req.userId]
    );

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Something went wrong updating your profile' });
  }
}

// POST /api/users/me/location
async function updateMyLocation(req, res) {
  const { lat, lng } = req.body;

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'lat and lng must be numbers' });
  }

  try {
    await pool.query(
      `UPDATE users
       SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
       WHERE id = $3`,
      [lng, lat, req.userId]
    );

    res.json({ message: 'Location updated' });
  } catch (err) {
    console.error('Update location error:', err);
    res.status(500).json({ error: 'Something went wrong updating your location' });
  }
}

// POST /api/users/me/offer-tags
async function addOfferTag(req, res) {
  const { tag } = req.body;

  if (!tag || typeof tag !== 'string') {
    return res.status(400).json({ error: 'tag is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO user_offer_tags (user_id, tag) VALUES ($1, $2) RETURNING id, tag',
      [req.userId, tag.trim().toLowerCase()]
    );

    res.status(201).json({ tag: result.rows[0] });
  } catch (err) {
    console.error('Add offer tag error:', err);
    res.status(500).json({ error: 'Something went wrong adding that tag' });
  }
}

// DELETE /api/users/me/offer-tags/:id
async function removeOfferTag(req, res) {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM user_offer_tags WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    res.json({ message: 'Tag removed' });
  } catch (err) {
    console.error('Remove offer tag error:', err);
    res.status(500).json({ error: 'Something went wrong removing that tag' });
  }
}

// GET /api/users/:id  (public profile view - no email/phone exposed)
async function getPublicProfile(req, res) {
  const { id } = req.params;

  try {
    const userResult = await pool.query(
      `SELECT id, name, bio, profile_photo_url, phone_verified, created_at
       FROM users WHERE id = $1 AND is_active = true`,
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const tagsResult = await pool.query(
      'SELECT tag FROM user_offer_tags WHERE user_id = $1',
      [id]
    );

    const ratingsResult = await pool.query(
      'SELECT ROUND(AVG(score), 1) AS avg_score, COUNT(*) AS total FROM ratings WHERE ratee_id = $1',
      [id]
    );

    res.json({
      user: userResult.rows[0],
      offerTags: tagsResult.rows.map((r) => r.tag),
      rating: ratingsResult.rows[0],
    });
  } catch (err) {
    console.error('Get public profile error:', err);
    res.status(500).json({ error: 'Something went wrong fetching this profile' });
  }
}

module.exports = {
  getMyProfile,
  updateMyProfile,
  updateMyLocation,
  addOfferTag,
  removeOfferTag,
  getPublicProfile,
};
