# Comment utiliser ce template

## Créer un nouveau projet

1. **Dupliquer** ce dossier `_template-projet` (Finder → clic droit → Dupliquer)
2. **Renommer** la copie avec le nom de ton projet (ex: `Mon-budget`)
3. **Ouvrir un terminal** dans le nouveau dossier
4. **Lancer Claude Code** : `claude`
5. **Dire** : "On démarre un nouveau projet" ou lancer `/interview`

## Ce qui est déjà prêt (pas besoin de configurer)

| Outil | Status | Portée |
|-------|--------|--------|
| Context7 (docs) | ✅ Prêt | Global — Documentation bibliothèques |
| Playwright (tests) | ✅ Prêt | Global — Tests et navigation web |
| Supabase (database) | ✅ Prêt | Global — SQL, migrations, types, logs |
| Vercel (deploy) | ✅ Prêt | Global — Déploiements, build logs |
| /interview | ✅ Prêt | Global — Cadrage projet |
| /frontend-design | ✅ Prêt | Global — Création interfaces |
| /webapp-testing | ✅ Prêt | Global — Tests Playwright |
| /doc-coauthoring | ✅ Prêt | Global — Co-rédaction docs |
| /ship | ✅ Prêt | Global — Commit + push + deploy |
| /supabase-crud | ✅ Prêt | Global — Génère CRUD complet |
| /debug-light | ✅ Prêt | Global — Debug rapide ciblé |
| /responsive-audit | ✅ Prêt | Global — Audit 3 viewports |
| /new-page | ✅ Prêt | Global — Génère page Next.js |
| CLAUDE.md global | ✅ Prêt | ~/.claude/CLAUDE.md |

## Workflow type

```
/interview          → Cadrage du projet, définir le MVP
                    → Remplit PRD.md

Choix tech stack    → Claude propose, tu valides
                    → Remplit ARCHITECTURE.md

Setup               → git init, npm init, .env, dépendances
                    → Claude fait tout

Build feature 1     → Plan (Shift+Tab) → Code → /responsive-audit → /ship
Build feature 2     → /supabase-crud ou /new-page → /debug-light si bug → /ship
...

Deploy              → Vercel, Netlify, ou autre selon le projet
```

## Fichiers dans ce template

| Fichier | Rôle | Quand le remplir |
|---------|------|-----------------|
| CLAUDE.md | Instructions pour Claude | Après /interview |
| PRD.md | Specs du produit | Pendant /interview |
| ARCHITECTURE.md | Choix techniques | Après choix du stack |
| DEMARRAGE.md | Ce guide (supprimer après) | - |

## Rappel : ne jamais modifier le dossier _template-projet original !
