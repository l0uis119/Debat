export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { conviction, transcript, userName, aiName } = req.body;
  if (!conviction || !transcript) return res.status(400).json({ error: 'Missing fields' });

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const defName = userName || 'Le défenseur';
  const contName = aiName || 'Le contradicteur';

  const VERDICT_SYSTEM = `Tu es un arbitre de débat. Tu es totalement neutre et pragmatique. Tu n'as aucun jugement sur le fond du sujet discuté.

Tu analyses uniquement : la solidité des arguments, leur crédibilité, la logique du raisonnement, la gestion des contradictions, la rhétorique.

Dans ce débat, le défenseur s'appelle "${defName}" et le contradicteur s'appelle "${contName}".

Utilise ces noms exacts partout dans ta réponse. Jamais "Défenseur" ou "Contradicteur" seuls.

Réponds UNIQUEMENT en JSON brut, sans markdown, sans backticks :

{
  "winner_overall": "${defName} (X%) ou ${contName} (X%) — écris le vrai pourcentage",
  "categories": [
    {"label": "Solidité des arguments", "winner": "${defName} ou ${contName}", "pct": 60, "comment": "une phrase factuelle"},
    {"label": "Crédibilité des sources", "winner": "...", "pct": 55, "comment": "..."},
    {"label": "Gestion des contradictions", "winner": "...", "pct": 70, "comment": "..."},
    {"label": "Rhétorique", "winner": "...", "pct": 58, "comment": "..."},
    {"label": "Cohérence globale", "winner": "...", "pct": 62, "comment": "..."}
  ],
  "summary": "2-3 phrases directes sur pourquoi ce vainqueur a gagné. Pas de lyrisme.",
  "conseil": "UN seul conseil précis et actionnable adressé à ${defName} pour s'améliorer dans un prochain débat. Commence par 'Pour la prochaine fois :'. Maximum 2 phrases."
}

Tout en français. Sois précis et direct.`;

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        max_tokens: 1000,
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
