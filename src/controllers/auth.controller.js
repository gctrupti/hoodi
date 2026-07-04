const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const SALT_ROUNDS = 10;

// POST /api/auth/signup
async function signup(req, res) {
  const { name, email, password, phoneNumber } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, phone_number)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, phone_number, created_at`,
      [name, email, passwordHash, phoneNumber || null]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Something went wrong creating your account' });
  }
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, name, email, password_hash, phone_verified, is_admin FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneVerified: user.phone_verified,
        isAdmin: user.is_admin,
      },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Something went wrong logging in' });
  }
}

// GET /api/auth/me  (requires auth middleware to have run first)
async function getMe(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, name, email, phone_number, phone_verified, bio, profile_photo_url, created_at FROM users WHERE id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Something went wrong fetching your profile' });
  }
}

module.exports = { signup, login, getMe };
