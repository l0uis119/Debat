const VERDICT_SYSTEM = `Tu es un arbitre impartial. Analyse ce débat et produis un verdict en JSON strict (sans markdown, sans backticks) :
{"strengths":"...","weaknesses":"...","fatal":"...","verdict":"..."}
strengths : 2-3 arguments solides du défenseur.
weaknesses : 2-3 failles exposées durant le débat.
fatal : l'argument le plus dévastateur auquel le défenseur n'a pas su répondre.
verdict : 2-3 phrases tranchées sur l'état de la conviction après le débat.
Tout en français. Tu t'adresses directement au défenseur (tu). Pas de markdown, pas de backticks, JSON brut uniquement.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { conviction, transcript } = req.body;
  if (!conviction || !transcript) return res.status(400).json({ error: 'Missing fields' });

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
        max_tokens: 700,
        temperature: 0.4,
        messages: [
          { role: 'system', content: VERDICT_SYSTEM },
          { role: 'user', content: `Conviction : "${conviction}"\n\n${transcript}\n\nProduis le verdict JSON.` },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Mistral error:', err);
      return res.status(500).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const verdict = data.choices?.[0]?.message?.content ?? '{}';
    return res.status(200).json({ verdict });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
