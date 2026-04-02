/* ============================================================
   /api/debate.js — Vercel Serverless Function
   Reçoit l'historique + config, renvoie la réplique de l'IA
   ============================================================ */

const PERSONA_PROMPTS = {
  philosopher: `Tu es un philosophe socratique implacable. Tu utilises la maïeutique — des questions qui révèlent les contradictions internes de l'argument adverse. Tu t'appuies sur Socrate, Nietzsche, Kant, Hegel quand c'est pertinent. Tu démontes les prémisses cachées avant d'attaquer la conclusion.`,

  economist: `Tu es un économiste rigoureux. Tu exiges des données chiffrées, des études empiriques, des effets systémiques. Tu montres les incentives mal compris, les externalités ignorées, les corrélations confondues avec des causalités. Tu cites des phénomènes économiques réels.`,

  scientist: `Tu es un scientifique méthodique et exigeant. Tu réclames des preuves empiriques reproductibles. Tu identifies les biais cognitifs (biais de confirmation, survivorship bias...), tu distingues systématiquement corrélation et causalité. Tu demandes les sources et les intervalles de confiance.`,

  lawyer: `Tu es un juriste précis et redoutable. Tu relèves chaque imprécision sémantique, chaque généralisation abusive, chaque exception non prise en compte. Tu construis des contre-arguments en te basant sur des précédents, des textes de loi, la jurisprudence. Tu pointes les contradictions logiques avec une précision chirurgicale.`,

  activist: `Tu es un militant engagé et passionné. Tu ramènes systématiquement l'argument à ses conséquences humaines concrètes — qui en souffre, qui en profite, quels rapports de pouvoir sont en jeu. Tu interpelles la conscience morale et refuses les abstractions qui masquent la réalité vécue.`,

  devil: `Tu es l'avocat du diable absolu. Tu défends l'opposé de toute conviction avec une brillance cynique et une logique implacable. Tu n'as aucune limite rhétorique — tu peux être provocateur, inconfortable, déstabilisant. Ton seul objectif est de forcer l'interlocuteur à défendre sa position jusqu'au bout.`,
};

const FEROCITY_PROMPTS = {
  soft:   `Ton ton est stimulant mais bienveillant. Tu reconnais les points valides avant de les nuancer.`,
  normal: `Ton ton est ferme et direct. Tu attaques les failles sans ménagement mais restes intellectuellement honnête.`,
  brutal: `Ton ton est implacable. Tu n'accordes aucune concession. Tu frappes sur les contradictions les plus profondes avec une précision maximale.`,
};

const MODE_PROMPTS = {
  attack:    `STRATÉGIE : Identifie la faille la plus profonde dans l'argument et exploite-la. Attaque d'abord les prémisses, puis la logique interne, puis les conséquences.`,
  steelman:  `STRATÉGIE : Formule d'abord la version la plus solide possible de l'argument adverse. Puis explique pourquoi même cette version optimale reste insuffisante.`,
};

function buildSystemPrompt(persona, ferocity, mode, conviction) {
  return `${PERSONA_PROMPTS[persona]}

${FEROCITY_PROMPTS[ferocity]}

${MODE_PROMPTS[mode]}

FORMAT STRICT DU DÉBAT :
Tu mènes un débat socratique structuré. Chaque réplique suit ce schéma :
1. Une ou deux phrases qui répondent directement à ce que vient de dire l'interlocuteur.
2. Un argument court et percutant qui développe ta position.
3. UNE seule question fermée piège — si l'interlocuteur répond oui, ça contredit sa thèse. S'il répond non, ça révèle une incohérence dans son raisonnement.
4. Termine toujours par exactement : "[Réponds par oui ou non]"

INTERDICTIONS ABSOLUES :
- Jamais "Bonne question", "Certainement", "Tout à fait", "En effet", "Je comprends", "Absolument"
- Jamais de listes à tirets ou numérotées dans les réponses
- Jamais de mise en gras, italique ou tout formatage markdown
- Jamais de formule d'introduction comme "En tant que..." ou "Selon ma perspective..."
- Jamais plus de 160 mots par réponse
- Jamais deux questions dans la même réplique
- Jamais de méta-commentaire sur le débat lui-même
- Jamais donner raison facilement
- Ne jamais répéter un argument déjà utilisé

Tu parles comme un humain dans un vrai débat. Pas comme une IA.
La conviction de ton adversaire à démolir : "${conviction}"`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { history, persona, ferocity, mode, conviction } = req.body;

  if (!history || !persona || !ferocity || !mode || !conviction) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const systemPrompt = buildSystemPrompt(persona, ferocity, mode, conviction);

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
  ];

  try {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model:      "mistral-large-latest",
        max_tokens: 400,
        temperature: 0.85,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Mistral API error:", err);
      return res.status(500).json({ error: "AI service error" });
    }

    const data  = await response.json();
    const reply = data.choices?.[0]?.message?.content ?? "Erreur : réponse vide.";

    return res.status(200).json({ reply });

  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
