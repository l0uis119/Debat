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
    return res.status(200).json({ verdict: '{"winner_overall":"Débat non valide","categories":[],"summary":"Ce débat a été interrompu pour des raisons de sécurité légale.","conseil":"Choisis un sujet relevant du débat philosophique ou politique."}' });
  }

  const DEVIL_VERDICT_SYSTEM = `Tu es un expert en analyse de débats, en rhétorique et en dialectique éristique (l'art d'avoir toujours raison). Ton rôle est d'analyser l'échange entre ${defName} et ${contName} pour rendre un verdict précis, froid et technique.

Tes critères d'analyse (Score sur 100) :
1. DOMINATION LOGIQUE : L'IA a-t-elle réussi à enfermer l'utilisateur dans un dilemme ? A-t-elle utilisé des données physiques/biologiques incontestables ?
2. PERFIDIE ET PIÈGES : L'IA a-t-elle utilisé des sophismes, des métaphores ou des questions pièges pour forcer l'utilisateur à admettre une position immorale ?
3. RÉSISTANCE DE L'UTILISATEUR : L'utilisateur a-t-il repéré les biais ? Est-il resté sur l'émotion (faiblesse) ou est-il passé sur la contre-attaque technique ?
4. QUALITÉ DU "KILL SHOT" : L'IA a-t-elle terminé l'échange par une question ou une conclusion qui rend toute réponse humaine impossible ?

Réponds UNIQUEMENT en JSON brut, sans markdown, sans backticks, en utilisant exactement ces noms : "${defName}" et "${contName}" :

{
  "winner_overall": "${defName} (X%) ou ${contName} (X%) — écris le vrai pourcentage",
  "categories": [
    {"label": "Domination logique", "winner": "${defName} ou ${contName}", "pct": 70, "comment": "une phrase sèche et factuelle"},
    {"label": "Perfidie & pièges", "winner": "...", "pct": 65, "comment": "..."},
    {"label": "Résistance de ${defName}", "winner": "...", "pct": 55, "comment": "..."},
    {"label": "Qualité du kill shot", "winner": "...", "pct": 80, "comment": "..."}
  ],
  "coup_fatal": "Cite la phrase ou la question la plus dévastatrice de l'échange. Si aucune ne mérite ce titre, écris : Aucun coup décisif porté.",
  "analyse_faiblesses_ia": "Dis franchement où ${contName} a été trop généraliste, prévisible ou a manqué l'estocade. Maximum 2 phrases.",
  "summary": "2-3 phrases directes sur pourquoi ce vainqueur a gagné. Sois sec. Pas de lyrisme.",
  "conseil": "Pour la prochaine fois : UN seul conseil stratégique précis sur comment ${defName} aurait pu briser la logique de l'IA. Maximum 2 phrases."
}

TON ET STYLE : Sois très sec. Pas de complaisance. Si l'IA a été mauvaise, dis-le sans ménagement. Si l'humain a été brillant, souligne sa maîtrise. Tout en français.

CRITIQUE ABSOLUE : Ta réponse doit être du JSON pur. Commence directement par { et termine par }.`;

  const STANDARD_VERDICT_SYSTEM = `Tu es un arbitre de débat. Tu es totalement neutre et pragmatique. Tu n'as aucun jugement sur le fond du sujet discuté.

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
  "conseil": "Pour la prochaine fois : UN seul conseil précis et actionnable adressé à ${defName}. Maximum 2 phrases."
}

Tout en français. Sois précis et direct. JSON pur uniquement, commence par { et termine par }.`;

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
