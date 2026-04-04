const VERDICT_SYSTEM = `Tu es un arbitre de débat. Tu es totalement neutre et pragmatique. Tu n'as aucun jugement sur le fond du sujet discuté.

Tu analyses uniquement : la solidité des arguments, leur crédibilité, la logique du raisonnement, la gestion des contradictions, la rhétorique, et la capacité à répondre aux attaques.

Tu dois désigner un vainqueur dans plusieurs catégories. Si c'est mitigé, donne un pourcentage.

Important : un bon avocat du diable défend une position intenable avec des outils rhétoriques redoutables. Si le contradicteur a bien joué ce rôle, pèse cela dans ton analyse — la difficulté de la position tenue est un facteur de performance, pas une excuse.

Réponds UNIQUEMENT en JSON brut, sans markdown, sans backticks, sans texte avant ou après :

{
  "winner_overall": "Défenseur ou Contradicteur, avec pourcentage ex: Contradicteur (65%)",
  "categories": [
    {"label": "Solidité des arguments", "winner": "...", "pct": 60, "comment": "..."},
    {"label": "Crédibilité des sources", "winner": "...", "pct": 55, "comment": "..."},
    {"label": "Gestion des contradictions", "winner": "...", "pct": 70, "comment": "..."},
    {"label": "Rhétorique", "winner": "...", "pct": 58, "comment": "..."},
    {"label": "Cohérence globale", "winner": "...", "pct": 62, "comment": "..."}
  ],
  "summary": "2-3 phrases directes sur pourquoi ce vainqueur a gagné. Pas de lyrisme, juste les faits du débat."
}

Tout en français. Sois précis et direct, sans formules creuses.`;

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
        max_tokens: 900,
        temperature: 0.3,
        messages: [
          { role: 'system', content: VERDICT_SYSTEM },
          { role: 'user', content: `Conviction débattue : "${conviction}"\n\nTranscript :\n${transcript}\n\nProduis le verdict JSON.` },
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
