export default async function handler(req, res) {
  // CORS pour permettre les appels depuis le front
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { history, systemPrompt } = req.body;
  if (!history || !systemPrompt) return res.status(400).json({ error: 'Missing fields' });

  // La clé est lue depuis les variables d'environnement Vercel — jamais dans le code
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        max_tokens: 400,
        temperature: 0.85,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Mistral error:', err);
      return res.status(500).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content ?? '';
    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
