# Audit technique & game design — Navigateur-Game

## Périmètre analysé
- `index.html`, `style.css`
- `js/script.js`, `js/world.js`, `js/entities.js`, `js/input.js`, `js/ui.js`, `js/utils.js`

---

## 1) Architecture du code

### Problèmes identifiés

1. **Orchestration centrale trop chargée dans `script.js`** — **PRIORITÉ: IMPORTANT**  
   - `update()` gère pause, inventaire, interaction, combat, IA, respawn, caméra, UI.  
   - **Pourquoi c’est un problème**: le fichier devient vite un goulot d’évolutivité (quêtes, skills, loot, boss, triggers). Risque de régressions élevé.
   - **Solutions**:
     - Introduire un `GameStateManager` (états: playing/paused/dialogue/inventory/dead).
     - Séparer les systèmes en modules: `CombatSystem`, `InteractionSystem`, `AISystem`, `CameraSystem`, `UISystem`.

2. **Couplage gameplay/UI** — **PRIORITÉ: IMPORTANT**  
   - `script.js` appelle `ui.showDialogue(...)` depuis la logique métier et déclenche `ui.renderInventory()` à chaque frame.
   - **Pourquoi**: mélange de responsabilités et coût DOM inutile.
   - **Solutions**:
     - Mettre un bus d’événements (`PLAYER_DAMAGED`, `INVENTORY_UPDATED`, `NPC_INTERACTED`).
     - Rendre l’inventaire uniquement à l’ouverture/fermeture ou lors de mutation réelle.

3. **Modèle d’entités minimaliste sans composants** — **PRIORITÉ: CONFORT**  
   - Hiérarchie simple (`BaseEntity`, `Player`, `Npc`, `Enemy`) adaptée au prototype.
   - **Pourquoi**: limite la réutilisation quand les comportements divergent (projectiles, effets, boss multi-phases).
   - **Solutions**:
     - Introduire des composants légers (`Health`, `Mover`, `Collider`, `Brain`).

4. **Nommage globalement lisible, mais quelques termes ambigus** — **PRIORITÉ: CONFORT**  
   - Ex: `entities` est un agrégat partiel (npcs/enemies, pas player), `world.obstacles` mélange murs/eau/frontières.
   - **Pourquoi**: ambiguïtés qui gênent le debug.
   - **Solutions**:
     - Renommer en `hostiles`, `interactables`, `solidColliders`, etc.

5. **Gestion d’état implicite, sans source de vérité unique** — **PRIORITÉ: IMPORTANT**  
   - États éclatés (`paused`, classes CSS hidden, `attackCooldown`, `invulnerable`).
   - **Pourquoi**: risques d’états incohérents (ex: inventaire ouvert + pause + dialogue timer actif).
   - **Solutions**:
     - Créer une machine à états claire + priorités d’input selon l’état.

---

## 2) Performances

### Problèmes identifiés

1. **Collision O(n) sur tous les obstacles par déplacement** — **PRIORITÉ: CRITIQUE**  
   - `tryMove` parcourt `world.obstacles` à chaque axe et pour chaque entité.
   - **Pourquoi**: coûteux avec maps plus grandes / plus d’ennemis.
   - **Solutions**:
     - Spatial hash / grille de collision par tuiles solides.
     - Requête locale des colliders autour de l’entité (3x3 ou 5x5 tuiles).

2. **`ui.renderInventory()` appelé chaque frame** — **PRIORITÉ: IMPORTANT**  
   - Rebuild DOM complet en continu.
   - **Pourquoi**: consommation CPU/GC inutile, micro-lags possibles.
   - **Solutions**:
     - Rendering événementiel (dirty flag `inventoryDirty`).

3. **Minimap redessinée entièrement à chaque frame** — **PRIORITÉ: IMPORTANT**  
   - Fond de zones + tous points NPC/ennemis + joueur, à 60fps.
   - **Pourquoi**: acceptable ici, mais non scalable.
   - **Solutions**:
     - Pré-rendre le fond minimap sur canvas offscreen, ne mettre à jour que les marqueurs dynamiques.

4. **Caméra sans lissage** — **PRIORITÉ: CONFORT**  
   - Suit directement le joueur.
   - **Pourquoi**: sensation visuelle plus “raide”, tremblement perceptible lors des collisions.
   - **Solutions**:
     - Lerp/spring camera + dead zone.

5. **Risque de charge IA linéaire** — **PRIORITÉ: IMPORTANT**  
   - Chaque ennemi fait `distance(this, player)` + collisions + path simple à chaque frame.
   - **Pourquoi**: explosion de coût avec densité ennemie.
   - **Solutions**:
     - Tick IA décimé (10–20 Hz), LOD IA hors écran, activation par proximité.

6. **Gestion mémoire: listeners d’inventaire recréés souvent** — **PRIORITÉ: CONFORT**  
   - DOM réinitialisé + closures re-créées.
   - **Pourquoi**: pression GC évitable.
   - **Solutions**:
     - Délégation d’événement sur `<ul>` et dataset d’index.

---

## 3) Gameplay

### Problèmes identifiés

1. **Déplacements corrects mais peu expressifs (pas d’inertie/accélération)** — **PRIORITÉ: IMPORTANT**  
   - Mouvement instantané, vitesse binaire marche/course.
   - **Pourquoi**: sensation arcade “sèche”, peu RPG action moderne.
   - **Solutions**:
     - Ajouter accélération/freinage léger, courbe de vitesse, animation directionnelle.

2. **Combat mêlée simpliste (AoE circulaire instantanée)** — **PRIORITÉ: IMPORTANT**  
   - Attaque touche tous les ennemis dans 42px.
   - **Pourquoi**: faible profondeur tactique, exploitable en kite.
   - **Solutions**:
     - Cône d’attaque orienté selon direction, wind-up court, knockback, stamina.

3. **Progression joueur quasi absente** — **PRIORITÉ: CRITIQUE**  
   - Pas d’XP, pas de niveaux, pas de scaling.
   - **Pourquoi**: risque d’ennui rapide et boucle de motivation faible.
   - **Solutions**:
     - Introduire boucle “combattre → loot/XP → amélioration stats/skills”.

4. **Risque de frustration sur respawn instantané sans contexte** — **PRIORITÉ: CONFORT**  
   - Mort → message + respawn immédiat.
   - **Pourquoi**: peu de lisibilité des conséquences et apprentissage.
   - **Solutions**:
     - Écran court de death recap, invuln respawn visible, perte/retour ressource contrôlée.

---

## 4) Monde ouvert

### Problèmes identifiés

1. **Map segmentée en bandes rectangulaires très artificielles** — **PRIORITÉ: IMPORTANT**  
   - Forêt/plaine/village/donjon en colonnes nettes.
   - **Pourquoi**: faible crédibilité d’open world.
   - **Solutions**:
     - Génération par bruit (noise), bords organiques, biomes mixtes et points d’intérêt.

2. **Transitions abruptes et barrières “dures”** — **PRIORITÉ: IMPORTANT**  
   - Murs/eau/lignes de blocage massives.
   - **Pourquoi**: navigation peu naturelle.
   - **Solutions**:
     - Goulots visuels motivés (ponts, portes, falaises), guidage environnemental doux.

3. **Densité de contenu faible** — **PRIORITÉ: CRITIQUE**  
   - Peu de PNJ, peu d’interactions systémiques, pas de quêtes.
   - **Pourquoi**: sensation de vide.
   - **Solutions**:
     - Ajouter rencontres, événements, récolte, micro-objectifs, lore spots.

4. **Lisibilité visuelle limitée (codes couleur seuls)** — **PRIORITÉ: CONFORT**  
   - Tiles unicolores.
   - **Pourquoi**: difficulté à lire affordances (où aller, danger, intérêt).
   - **Solutions**:
     - Variantes de tiles, landmarks, signalétique lumineuse/forme.

---

## 5) Combat

### Problèmes identifiés

1. **Hitboxes peu explicites pour le joueur** — **PRIORITÉ: IMPORTANT**  
   - Cercle de portée n’apparaît qu’au timing cooldown (`>0.22`) et pas toujours au bon moment de lecture.
   - **Pourquoi**: feedback spatial incertain.
   - **Solutions**:
     - Afficher télégraphe clair au déclenchement + direction de frappe.

2. **Feedback limité (pas de son, peu de VFX)** — **PRIORITÉ: IMPORTANT**  
   - Flash de hit ennemi + barre PV uniquement.
   - **Pourquoi**: impacts peu satisfaisants, lisibilité dégâts faible.
   - **Solutions**:
     - Hitstop léger, chiffres de dégâts, son de coup/reçu, particules simples.

3. **IA ennemie basique (chase/roam)** — **PRIORITÉ: IMPORTANT**  
   - Aucun contournement d’obstacle ni patterns variés.
   - **Pourquoi**: combat répétitif, comportement “bump wall”.
   - **Solutions**:
     - États IA (idle/patrol/chase/attack/recover), timers d’attaque, archétypes.

4. **Exploit possible via portée/cooldowns** — **PRIORITÉ: IMPORTANT**  
   - Joueur peut toucher plusieurs ennemis en masse; ennemis sans coordination.
   - **Pourquoi**: trivialisation difficulté.
   - **Solutions**:
     - Limiter cibles par swing, i-frames ennemies courtes, spacing IA de groupe.

---

## 6) UI / UX

### Problèmes identifiés

1. **HUD lisible mais information combat incomplète** — **PRIORITÉ: IMPORTANT**  
   - Pas de stamina, pas de cooldown lisible, pas de journal d’objectifs.
   - **Pourquoi**: joueur manque de repères décisionnels.
   - **Solutions**:
     - Ajouter jauges contextuelles et objectifs actifs.

2. **Accessibilité limitée** — **PRIORITÉ: IMPORTANT**  
   - Contrôles non reconfigurables, dépendance couleurs, pas d’options taille texte/contraste.
   - **Pourquoi**: exclusion de profils joueurs.
   - **Solutions**:
     - Remapping touches, modes contraste, taille UI, feedback non-couleur.

3. **Confort clavier AZERTY partiel** — **PRIORITÉ: CONFORT**  
   - Mapping `zqsd` correct, mais pas de fallback QWERTY/locale.
   - **Pourquoi**: friction selon claviers.
   - **Solutions**:
     - Support `event.code` (`KeyW`, `KeyA`...), preset AZERTY/QWERTY.

4. **Dialogue non bloquant et éphémère** — **PRIORITÉ: CONFORT**  
   - Timer disparaît automatiquement.
   - **Pourquoi**: risque de manquer l’information.
   - **Solutions**:
     - Mode “click to continue” pour dialogues narratifs; historique court.

---

## 7) Bugs potentiels

### Problèmes identifiés

1. **Incohérence pause/inventaire/update UI** — **PRIORITÉ: IMPORTANT**  
   - `if (paused) return;` coupe l’update tôt, peut figer certains timers/rafraîchissements.
   - **Pourquoi**: état UI potentiellement désynchronisé (selon attentes design).
   - **Solutions**:
     - Séparer `updateGameplay` et `updateUI` (UI minimale même en pause).

2. **Collision axes séparés peut créer glissements non désirés** — **PRIORITÉ: CONFORT**  
   - Déplacement X puis Y donne un comportement de “wall sliding”.
   - **Pourquoi**: parfois souhaité, parfois glitch ressenti.
   - **Solutions**:
     - Résolution collision plus robuste (swept AABB, restitution paramétrable).

3. **Clé d’inventaire utilisable sans garde d’état forte** — **PRIORITÉ: CONFORT**  
   - Toggle possible en contexte combat/interaction.
   - **Pourquoi**: transitions état ambiguës.
   - **Solutions**:
     - Politique claire d’input par état + verrouillages.

4. **Dépendance framerate partiellement maîtrisée** — **PRIORITÉ: IMPORTANT**  
   - `dt` clamp à 33ms (bien), mais pas de fixed-step simulation.
   - **Pourquoi**: comportements divergents sur drops sévères.
   - **Solutions**:
     - Boucle fixe (ex: 60Hz sim) + interpolation rendu.

---

## 8) Sécurité & stabilité

### Problèmes identifiés

1. **Absence de gestion d’erreur explicite** — **PRIORITÉ: IMPORTANT**  
   - Hypothèse que tous éléments DOM existent.
   - **Pourquoi**: crash silencieux si intégration partielle/changement HTML.
   - **Solutions**:
     - Assertions au boot + fallback message utilisateur.

2. **Aucune persistance contrôlée (localStorage non utilisé)** — **PRIORITÉ: CONFORT**  
   - Pas de risque actuel de corruption de save, mais pas de reprise.
   - **Pourquoi**: limite produit.
   - **Solutions**:
     - Format de save versionné + validations + migration.

3. **Robustesse logique correcte mais sans tests automatiques** — **PRIORITÉ: IMPORTANT**  
   - Pas de tests unitaires/simulation.
   - **Pourquoi**: dette de fiabilité à chaque évolution.
   - **Solutions**:
     - Tests sur collisions, dégâts, transitions d’état, inventaire.

---

## 9) Évolutivité

### Problèmes identifiés

1. **Systèmes de quêtes/compétences absents du modèle** — **PRIORITÉ: CRITIQUE**  
   - Aucun conteneur de progression narrative/gameplay.
   - **Pourquoi**: bloquant pour RPG open world.
   - **Solutions**:
     - Ajouter `QuestManager`, `SkillTree`, `Stats/Modifiers`, events globaux.

2. **Sauvegarde non implémentée** — **PRIORITÉ: CRITIQUE**  
   - Pas de persistence player/world state.
   - **Pourquoi**: session jetable, friction utilisateur.
   - **Solutions**:
     - Save JSON versionnée (profil, inventaire, quêtes, monde), auto-save + slot.

3. **Support mobile inexistant** — **PRIORITÉ: IMPORTANT**  
   - Pas de controls tactiles, canvas fixe 960x540.
   - **Pourquoi**: faible couverture plateforme.
   - **Solutions**:
     - UI responsive, joystick virtuel, boutons action, DPR scaling.

4. **Multiplateforme desktop limité au clavier** — **PRIORITÉ: CONFORT**  
   - Pas de gamepad.
   - **Pourquoi**: confort joueur réduit.
   - **Solutions**:
     - Abstraction input (keyboard/gamepad/touch).

---

## Roadmap priorisée (actionnable)

### Phase 1 — Stabilisation & perf (1–2 semaines)
1. Remplacer collision obstacle O(n) par grille de collision indexée. (**CRITIQUE**)  
2. Retirer `ui.renderInventory()` du loop; passer en rendu événementiel. (**IMPORTANT**)  
3. Introduire `GameStateManager` (playing/paused/inventory/dialogue). (**IMPORTANT**)  
4. Ajouter tests unitaires minimaux: dégâts, cooldowns, collisions, inventaire. (**IMPORTANT**)

### Phase 2 — Fondations RPG (2–4 semaines)
1. Implémenter progression (XP/niveaux/stats), loot simple, économie de base. (**CRITIQUE**)  
2. Mettre en place `QuestManager` + 3 quêtes tutoriels. (**CRITIQUE**)  
3. Refonte combat v1: direction d’attaque, feedback VFX/SFX, archétypes ennemis. (**IMPORTANT**)

### Phase 3 — Monde ouvert crédible (3–6 semaines)
1. Refonte génération map (biomes organiques + POI + routes). (**IMPORTANT**)  
2. Densifier contenu (rencontres, events, interactions environnementales). (**CRITIQUE**)  
3. Navigation assistée légère (mini-objectifs, landmarks). (**IMPORTANT**)

### Phase 4 — Produit & plateforme (2–4 semaines)
1. Système de sauvegarde versionné + migration. (**CRITIQUE**)  
2. Options accessibilité (remap, contraste, taille UI). (**IMPORTANT**)  
3. Préparation mobile/gamepad (input abstraction + responsive). (**IMPORTANT**)

---

## Conclusion
Le projet est une **base prototype saine** pour un action-RPG 2D web: structure simple, séparation en modules utilitaires/monde/entités/UI, loop claire. En revanche, pour viser un **RPG open-world “professionnel”**, les axes bloquants sont: **scalabilité des collisions**, **progression RPG absente**, **densité de contenu faible**, et **architecture d’état trop implicite**. La roadmap ci-dessus permet d’évoluer par incréments sans réécriture totale.
