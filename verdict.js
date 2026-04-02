/* ============================================================
   /api/verdict.js — Vercel Serverless Function
   Analyse le débat complet et renvoie un verdict structuré en JSON
   ============================================================ */

const VERDICT_SYSTEM = `Tu es un arbitre impartial et lucide. Tu analyses des débats et produis des verdicts honnêtes, sans complaisance.

Tu reçois un historique de débat complet. Tu dois produire un verdict structuré en JSON avec exactement ces 4 champs :

{
  "strengths": "Description des 2-3 arguments les plus solides défendus. Sois précis et cite les arguments réels du débat.",
  "weaknesses": "Description des 2-3 failles principales exposées au cours du débat. Sois direct et sans ménagement.",
  "fatal": "L'argument adverse le plus dévastateur auquel le défenseur n'a pas su répondre de manière satisfaisante. S'il n'y en a pas, dis-le honnêtement.",
  "verdict": "Un verdict global en 2-3 phrases tranchées : la conviction est-elle renforcée, fragilisée ou effondrée ? Justifie."
}

RÈGLES :
- Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks, sans texte avant ou après
- Tout en français
- Adresse-toi directement au défenseur (tu/vous)
- Sois honnête même si c'est inconfortable — un bon verdict aide à progresser`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { history, conviction } = req.body;

  if (!history || !conviction) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Construit le transcript lisible
  const transcript = history
    .map((m) => {
      const who = m.role === "user" ? "DÉFENSEUR" : "CONTRADICTEUR";
      return `${who} : ${m.content}`;
    })
    .join("\n\n");

  const userMessage = `Conviction initiale : "${conviction}"\n\nTranscript du débat :\n\n${transcript}\n\nProduis le verdict JSON.`;

  try {
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model:      "mistral-large-latest",
        max_tokens: 800,
        messages: [
          { role: "system", content: VERDICT_SYSTEM },
          { role: "user",   content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Mistral API error:", err);
      return res.status(500).json({ error: "AI service error" });
    }

    const data   = await response.json();
    const raw    = data.choices?.[0]?.message?.content ?? "{}";

    // Vérifie que c'est du JSON valide avant de renvoyer
    try {
      JSON.parse(raw);
    } catch {
      console.error("Invalid JSON from AI:", raw);
      return res.status(500).json({ error: "Invalid verdict format" });
    }

    return res.status(200).json({ verdict: raw });

  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
