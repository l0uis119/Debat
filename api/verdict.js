export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { conviction, transcript, userName, aiName, persona } = req.body;
  if (!conviction || !transcript) return res.status(400).json({ error: 'Missing fields' });

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const defName = userName || 'Le défenseur';
  const contName = aiName || 'Le contradicteur';

  const REFUSAL_MSG = "Cette requête enfreint les politiques de sécurité";
  if (transcript.includes(REFUSAL_MSG)) {
    return res.status(200).json({ verdict: '{"robustesse":0,"robustesse_label":"Débat non valide","categories":[],"summary":"Ce débat a été interrompu pour des raisons de sécurité légale.","conseil":"Choisis un sujet relevant du débat philosophique ou politique."}' });
  }

  const DEVIL_VERDICT_SYSTEM = `Tu es un expert en analyse de débats, en rhétorique et en dialectique éristique. Ton rôle est d'évaluer avec précision la robustesse de l'idée défendue par ${defName} face à ${contName}.

Tes critères d'analyse :
1. DOMINATION LOGIQUE : L'IA a-t-elle réussi à enfermer l'utilisateur dans un dilemme ?
2. PERFIDIE ET PIÈGES : L'IA a-t-elle utilisé des sophismes ou questions pièges ?
3. RÉSISTANCE DE L'UTILISATEUR : L'utilisateur a-t-il repéré les biais ?
4. QUALITÉ DU "KILL SHOT" : L'IA a-t-elle terminé par une conclusion imparable ?

Réponds UNIQUEMENT en JSON brut, sans markdown, sans backticks :

{
  "robustesse": <entier entre 0 et 100 basé sur ton analyse réelle du transcript>,
  "robustesse_label": "<formule 3-5 mots qualifiant l'état de l'idée>",
  "conseil": "<UN seul conseil stratégique précis pour ${defName}. Maximum 2 phrases.>",
  "categories": [
    {"label": "Domination logique", "winner": "<${defName} ou ${contName}>", "pct": <entier 0-100>, "comment": "<une phrase factuelle>"},
    {"label": "Perfidie & pièges", "winner": "<${defName} ou ${contName}>", "pct": <entier 0-100>, "comment": "<une phrase factuelle>"},
    {"label": "Résistance de ${defName}", "winner": "<${defName} ou ${contName}>", "pct": <entier 0-100>, "comment": "<une phrase factuelle>"},
    {"label": "Qualité du kill shot", "winner": "<${defName} ou ${contName}>", "pct": <entier 0-100>, "comment": "<une phrase factuelle>"}
  ],
  "coup_fatal": "<Cite la phrase la plus dévastatrice de l'échange, ou : Aucun coup décisif porté.>",
  "analyse_faiblesses_ia": "<Où ${contName} a été trop généraliste ou a manqué l'estocade. Maximum 2 phrases.>",
  "summary": "<2-3 phrases directes sur les forces et failles de l'idée. Sois sec.>"
}

RÈGLES POUR robustesse — évalue honnêtement d'après le transcript :
- 0-30 : l'idée s'est effondrée sous la contradiction
- 31-50 : des failles majeures non résolues
- 51-70 : l'idée tient mais avec des zones fragiles
- 71-85 : solide, quelques vulnérabilités mineures
- 86-100 : l'idée a résisté à presque tout

IMPORTANT : Les valeurs numériques doivent refléter ce transcript précis. Ne jamais utiliser les valeurs des exemples. Tout en français. JSON pur uniquement, commence par { et termine par }.`;

  const STANDARD_VERDICT_SYSTEM = `Tu es un analyste d'argumentation. Tu évalues la robustesse d'une idée face à la contradiction, de façon neutre et technique.

Tu analyses : la solidité des arguments, leur crédibilité, la logique du raisonnement, la gestion des contradictions, la rhétorique.

Le défenseur s'appelle "${defName}" et le contradicteur s'appelle "${contName}". Utilise ces noms exacts partout.

Réponds UNIQUEMENT en JSON brut, sans markdown, sans backticks :

{
  "robustesse": <entier entre 0 et 100 basé sur ton analyse réelle du transcript>,
  "robustesse_label": "<formule 3-5 mots qualifiant l'état de l'idée>",
  "conseil": "<UN seul conseil précis et actionnable pour ${defName}. Maximum 2 phrases.>",
  "categories": [
    {"label": "Solidité des arguments", "winner": "<${defName} ou ${contName}>", "pct": <entier 0-100>, "comment": "<une phrase factuelle>"},
    {"label": "Crédibilité des sources", "winner": "<${defName} ou ${contName}>", "pct": <entier 0-100>, "comment": "<une phrase factuelle>"},
    {"label": "Gestion des contradictions", "winner": "<${defName} ou ${contName}>", "pct": <entier 0-100>, "comment": "<une phrase factuelle>"},
    {"label": "Rhétorique", "winner": "<${defName} ou ${contName}>", "pct": <entier 0-100>, "comment": "<une phrase factuelle>"},
    {"label": "Cohérence globale", "winner": "<${defName} ou ${contName}>", "pct": <entier 0-100>, "comment": "<une phrase factuelle>"}
  ],
  "summary": "<2-3 phrases directes sur les forces et failles de l'idée. Pas de lyrisme.>"
}

RÈGLES POUR robustesse — évalue honnêtement d'après le transcript :
- 0-30 : l'idée s'est effondrée sous la contradiction
- 31-50 : des failles majeures non résolues
- 51-70 : l'idée tient mais avec des zones fragiles
- 71-85 : solide, quelques vulnérabilités mineures
- 86-100 : l'idée a résisté à presque tout

IMPORTANT : Les valeurs numériques doivent refléter ce transcript précis. Ne jamais utiliser les valeurs des exemples. Tout en français. JSON pur uniquement, commence par { et termine par }.`;

  const VERDICT_SYSTEM = persona === 'devil' ? DEVIL_VERDICT_SYSTEM : STANDARD_VERDICT_SYSTEM;

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        max_tokens: 1200,
        temperature: 0.7,
        messages: [
          { role: 'system', content: VERDICT_SYSTEM },
          { role: 'user', content: `Conviction débattue : "${conviction}"\n\nTranscript :\n${transcript}\n\nAnalyse ce transcript et produis le JSON. Les scores doivent refléter ce qui s'est réellement passé dans cet échange précis.` },
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
