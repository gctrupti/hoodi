// Calls the Anthropic API to classify a help request's category and urgency
// from free-text description. Falls back gracefully if the AI call fails —
// the user's own manual selection always still works either way.

const VALID_CATEGORIES = [
  'grocery', 'elderly_care', 'blood_donation', 'transportation',
  'emergency', 'errand', 'first_aid', 'other',
];
const VALID_URGENCY = ['normal', 'today', 'emergency'];

async function categorizeRequest(title, description) {
  const prompt = `You are classifying a community help request for a mutual-aid app.

Title: "${title}"
Description: "${description}"

Classify this into exactly one category from this list: ${VALID_CATEGORIES.join(', ')}
And exactly one urgency level from this list: ${VALID_URGENCY.join(', ')}

Respond with ONLY a JSON object, no other text, in this exact format:
{"category": "...", "urgency": "...", "confidence": 0.0}

confidence should be a number between 0 and 1 representing how confident you are.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API returned status ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text?.trim() || '';

    // Strip potential markdown code fences before parsing
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Validate the AI's output against our known-good lists before trusting it
    if (!VALID_CATEGORIES.includes(parsed.category)) parsed.category = 'other';
    if (!VALID_URGENCY.includes(parsed.urgency)) parsed.urgency = 'normal';
    if (typeof parsed.confidence !== 'number') parsed.confidence = 0.5;

    return parsed;
  } catch (err) {
    console.error('AI categorization failed, falling back to defaults:', err.message);
    // Graceful fallback - request creation should never be blocked by AI failure
    return { category: 'other', urgency: 'normal', confidence: 0 };
  }
}

module.exports = { categorizeRequest, VALID_CATEGORIES, VALID_URGENCY };
