# Miroir de Débat

Un contradicteur implacable qui attaque ta conviction jusqu'à ce qu'elle tienne debout — ou s'effondre.

## Structure du projet

```
miroir-de-debat/
├── index.html          ← Interface complète (3 écrans)
├── css/
│   └── style.css       ← Design dark / tribunal
├── js/
│   └── app.js          ← Logique frontend
├── api/
│   ├── debate.js       ← Vercel function : appel Claude pour le débat
│   └── verdict.js      ← Vercel function : analyse et verdict final
├── vercel.json         ← Config déploiement
└── README.md
```

## Déploiement en 4 étapes

### 1. Crée un repo GitHub
```bash
git init
git add .
git commit -m "init: miroir de débat"
git remote add origin https://github.com/TON_USERNAME/miroir-de-debat.git
git push -u origin main
```

### 2. Connecte Vercel à GitHub
- Va sur vercel.com → New Project
- Importe ton repo GitHub
- Framework Preset : **Other** (pas Next.js)
- Clique Deploy — Vercel détecte le vercel.json automatiquement

### 3. Ajoute ta clé API Anthropic
- Dans Vercel → ton projet → Settings → Environment Variables
- Nom : `ANTHROPIC_API_KEY`
- Valeur : ta clé depuis console.anthropic.com
- Redéploie (Settings → Deployments → Redeploy)

### 4. C'est en ligne
Vercel te donne une URL publique. Chaque push sur `main` redéploie automatiquement.

## Obtenir une clé API Anthropic
1. Va sur console.anthropic.com
2. Crée un compte et ajoute un moyen de paiement
3. API Keys → Create Key
4. Copie la clé (elle ne s'affiche qu'une fois)

Le modèle utilisé est `claude-sonnet-4-5` — environ 0.003$ par échange de débat.
Pour un usage normal (100 débats/mois), compte moins de 5€/mois.

## Prochaines étapes (Phase 2)
- [ ] Supabase : sauvegarder les débats par utilisateur
- [ ] Authentification (Supabase Auth)
- [ ] Historique des débats
- [ ] Partage de débat par lien
