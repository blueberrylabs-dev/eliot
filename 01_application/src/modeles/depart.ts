// Les modèles de départ d'Eliot, dessinés pour lui (BRIEF § 6) : des pages prêtes à modifier,
// rangées par format, avec des cadres photo vides à remplir. Aucune marque réelle, aucune
// citation de personne réelle ; les textes sont des exemples à remplacer.

import type { Couleur, FormatPage } from "../modele/types";
import { cadre, degrade, emoji, etoiles, graphique, icone, ligne, OMBRE_DOUCE, qr, radial, rect, rond, tableau, texte, type Brouillon } from "./brouillons";

export interface ModeleDepart {
  id: string;
  nom: string;
  /** Format de page du modèle (identifiant de `FORMATS_PAGE`). */
  format: FormatPage["id"];
  /** Ce qu'il illustre, pour la recherche. */
  mots: string;
  fond: Couleur;
  elements: Brouillon[];
}

const blanc = "#ffffff";
const noir = "#111111";

// ---- Carré 1080 × 1080 ----

const CARRES: ModeleDepart[] = [
  {
    id: "soldes",
    nom: "Soldes",
    format: "carre",
    mots: "soldes promotion reduction remise vente pourcentage",
    fond: degrade(135, "#ff3c38", "#ff8a3d"),
    elements: [
      texte("SOLDES", 80, 120, 920, 260, { police: "Anton", couleur: blanc, espacement: 6 }),
      texte("D'HIVER", 80, 430, 920, 96, { police: "Anton", couleur: "#ffe9a8", espacement: 14 }),
      texte("sur toute la boutique", 90, 640, 560, 46, { police: "Montserrat", gras: true, couleur: blanc, alignement: "left" }),
      texte("Du 10 au 31 janvier", 90, 712, 560, 36, { police: "Montserrat", couleur: "#fff3e0", alignement: "left" }),
      rect(90, 850, 380, 100, blanc, { arrondi: 50, groupe: "bouton" }),
      texte("J'en profite", 90, 876, 380, 40, { police: "Montserrat", gras: true, couleur: "#e63b2e", groupe: "bouton" }),
      { ...rond(690, 600, 320, 320, "#ffe14d", { groupe: "badge" }), forme: "etoile", cotes: 16, rotation: 0 },
      texte("-50 %", 690, 702, 320, 96, { police: "Anton", couleur: "#d62828", groupe: "badge" }),
    ],
  },
  {
    id: "nouveau-produit",
    nom: "Nouveau produit",
    format: "carre",
    mots: "nouveau produit lancement nouveaute prix boutique",
    fond: "#f3ede4",
    elements: [
      cadre("arrondi", 140, 90, 800, 560, { fond: "#e2d9cc" }),
      rect(170, 120, 210, 56, noir, { arrondi: 28, groupe: "etiquette" }),
      texte("NOUVEAU", 170, 134, 210, 28, { police: "Montserrat", gras: true, couleur: blanc, espacement: 5, groupe: "etiquette" }),
      texte("Nom de ton produit", 90, 700, 900, 78, { police: "Playfair Display", gras: true }),
      texte("Une phrase courte qui dit pourquoi on va l'adorer.", 140, 820, 800, 34, { couleur: "#5b5348" }),
      texte("29,90 €", 90, 910, 900, 60, { police: "Montserrat", gras: true, couleur: "#b5562c" }),
    ],
  },
  {
    id: "citation",
    nom: "Citation",
    format: "carre",
    mots: "citation phrase inspiration motivation pensee",
    fond: "#141414",
    elements: [
      texte("“", 100, 40, 300, 380, { police: "Playfair Display", couleur: "#e0b04a", alignement: "left" }),
      texte("Chaque grand projet commence par une petite décision : celle de s'y mettre.", 120, 330, 840, 64, { police: "Playfair Display", italique: true, couleur: blanc, alignement: "left", interligne: 1.22 }),
      ligne(120, 790, 120, "#e0b04a", 6),
      texte("TA SIGNATURE", 120, 830, 700, 32, { police: "Montserrat", gras: true, couleur: "#e0b04a", alignement: "left", espacement: 6 }),
    ],
  },
  {
    id: "evenement",
    nom: "Événement",
    format: "carre",
    mots: "evenement soiree date lieu invitation lancement",
    fond: degrade(110, "#2b1055", "#7597de"),
    elements: [
      texte("SAMEDI 14 JUIN · 19 H", 90, 110, 900, 46, { police: "Bebas Neue", couleur: "#ffd166", espacement: 8 }),
      texte("Soirée de lancement", 90, 190, 900, 120, { police: "Syne", gras: true, couleur: blanc, interligne: 1.0 }),
      texte("Musique, surprises et premières démos. Entrée libre.", 140, 470, 800, 36, { couleur: "#e6e9ff" }),
      icone("map-pin", 250, 588, 56, "#ffd166", "tabler", { groupe: "lieu" }),
      texte("12 rue des Lilas, Lyon", 320, 596, 520, 38, { couleur: blanc, alignement: "left", groupe: "lieu" }),
      qr("https://", 440, 720, 200, "#2b1055", blanc),
      texte("Réserve ta place", 90, 945, 900, 34, { couleur: blanc, gras: true }),
    ],
  },
  {
    id: "avant-apres",
    nom: "Avant, après",
    format: "carre",
    mots: "avant apres comparaison resultat transformation",
    fond: blanc,
    elements: [
      texte("AVANT / APRÈS", 90, 60, 900, 84, { police: "Anton", espacement: 4 }),
      cadre("rectangle", 60, 200, 470, 740, { fond: "#e6e6e6" }),
      cadre("rectangle", 550, 200, 470, 740, { fond: "#d9d9d9" }),
      rect(90, 860, 180, 56, noir, { arrondi: 28, groupe: "avant" }),
      texte("AVANT", 90, 872, 180, 30, { police: "Montserrat", gras: true, couleur: blanc, groupe: "avant" }),
      rect(810, 860, 180, 56, "#ff5a5f", { arrondi: 28, groupe: "apres" }),
      texte("APRÈS", 810, 872, 180, 30, { police: "Montserrat", gras: true, couleur: blanc, groupe: "apres" }),
      texte("Résultat en 30 jours", 90, 975, 900, 36, { couleur: "#555555" }),
    ],
  },
  {
    id: "temoignage",
    nom: "Témoignage client",
    format: "carre",
    mots: "temoignage avis client etoiles recommandation",
    fond: "#fff6ec",
    elements: [
      ...etoiles(540, 170, 64, 32, "#f5a623"),
      texte("« Livraison rapide, produit parfait, je recommande à tout le monde. »", 120, 300, 840, 58, { police: "Fraunces", couleur: "#2b2118", interligne: 1.25 }),
      cadre("cercle", 470, 690, 140, 140, { fond: "#ead9c4" }),
      texte("Camille, cliente depuis 2024", 90, 860, 900, 34, { police: "Montserrat", gras: true, couleur: "#7a5c3e" }),
    ],
  },
  {
    id: "chiffres-cles",
    nom: "Chiffres clés",
    format: "carre",
    mots: "chiffres resultats statistiques bilan satisfaction graphique",
    fond: "#0f172a",
    elements: [
      texte("Nos résultats en 2026", 90, 80, 900, 60, { police: "Space Grotesk", gras: true, couleur: blanc }),
      graphique("progression", 340, 200, 400, 400, { police: "Space Grotesk", couleurTexte: blanc, series: [{ nom: "Valeur", couleur: "#22d3ee", valeurs: [93] }], couleursParts: ["#1e293b"], etiquettes: ["clients satisfaits"], maximum: 100, unite: "%" }),
      texte("12 000", 110, 680, 400, 96, { police: "Space Grotesk", gras: true, couleur: "#22d3ee" }),
      texte("commandes livrées", 110, 800, 400, 32, { couleur: "#cbd5e1" }),
      texte("4,9/5", 570, 680, 400, 96, { police: "Space Grotesk", gras: true, couleur: "#22d3ee" }),
      texte("note moyenne", 570, 800, 400, 32, { couleur: "#cbd5e1" }),
    ],
  },
  {
    id: "astuces",
    nom: "Trois astuces",
    format: "carre",
    mots: "astuces conseils liste etapes tutoriel",
    fond: "#fef3c7",
    elements: [
      texte("3 astuces pour des photos produit réussies", 90, 70, 900, 62, { police: "Poppins", gras: true, couleur: "#1f2937" }),
      ...[
        ["Lumière du jour", "Place-toi près d'une fenêtre, jamais en plein soleil."],
        ["Fond simple", "Un drap blanc ou un mur uni suffit."],
        ["Plusieurs angles", "De face, de trois quarts, et un détail en gros plan."],
      ].flatMap(([titre, detail], i) => {
        const y = 320 + i * 220;
        const g = `astuce${i}`;
        return [
          rond(110, y, 110, 110, "#f59e0b", { groupe: g }),
          texte(String(i + 1), 110, y + 22, 110, 58, { police: "Poppins", gras: true, couleur: blanc, groupe: g }),
          texte(titre, 260, y + 4, 720, 42, { police: "Poppins", gras: true, couleur: "#1f2937", alignement: "left", groupe: g }),
          texte(detail, 260, y + 62, 720, 30, { couleur: "#4b5563", alignement: "left", groupe: g }),
        ];
      }),
    ],
  },
  {
    id: "concours",
    nom: "Concours",
    format: "carre",
    mots: "concours jeu cadeau gagner tirage abonnes",
    fond: degrade(135, "#7b2ff7", "#f107a3"),
    elements: [
      emoji("wrapped-gift", 400, 50, 280),
      texte("CONCOURS", 60, 350, 960, 150, { police: "Luckiest Guy", couleur: blanc }),
      texte("Gagne ton panier découverte", 90, 535, 900, 48, { police: "Poppins", gras: true, couleur: "#ffe66d" }),
      rect(140, 640, 800, 300, blanc, { arrondi: 36, opacite: 0.16 }),
      texte("1. Abonne-toi au compte\n2. Aime ce post\n3. Identifie deux amis", 200, 680, 680, 42, { police: "Poppins", couleur: blanc, alignement: "left", interligne: 1.6 }),
      texte("Tirage au sort le 30 juin", 90, 985, 900, 32, { couleur: blanc }),
    ],
  },
  {
    id: "merci-abonnes",
    nom: "Merci aux abonnés",
    format: "carre",
    mots: "merci abonnes palier fete communaute",
    fond: radial("#1f2937", "#030712"),
    elements: [
      emoji("sparkles", 130, 120, 170),
      emoji("party-popper", 780, 120, 170),
      texte("MERCI", 90, 290, 900, 210, { police: "Bebas Neue", couleur: blanc, espacement: 12 }),
      texte("10 000", 90, 500, 900, 190, { police: "Anton", couleur: "#facc15" }),
      texte("abonnés, c'est grâce à vous", 90, 760, 900, 52, { police: "Poppins", couleur: "#e5e7eb" }),
    ],
  },
  {
    id: "menu-du-jour",
    nom: "Menu du jour",
    format: "carre",
    mots: "menu restaurant plat prix cuisine carte",
    fond: "#faf6f0",
    elements: [
      texte("Menu du jour", 90, 70, 900, 96, { police: "Playfair Display", gras: true, couleur: "#3b2f2f" }),
      ligne(440, 205, 200, "#c08457", 4),
      ...[
        ["Velouté de potimarron", "crème fraîche, graines torréfiées", "8 €"],
        ["Risotto aux champignons", "parmesan, persil plat", "16 €"],
        ["Tarte fine aux pommes", "glace vanille maison", "7 €"],
      ].flatMap(([plat, detail, prix], i) => {
        const y = 270 + i * 210;
        const g = `plat${i}`;
        return [
          texte(plat, 140, y, 620, 50, { police: "Cormorant Garamond", gras: true, couleur: "#3b2f2f", alignement: "left", groupe: g }),
          texte(prix, 760, y, 180, 50, { police: "Cormorant Garamond", gras: true, couleur: "#c08457", alignement: "right", groupe: g }),
          texte(detail, 140, y + 66, 700, 30, { italique: true, couleur: "#7a6a5a", alignement: "left", groupe: g }),
        ];
      }),
      texte("Ouvert du mardi au samedi, de 12 h à 14 h", 90, 960, 900, 30, { couleur: "#7a6a5a" }),
    ],
  },
  {
    id: "recrutement",
    nom: "On recrute",
    format: "carre",
    mots: "recrutement emploi poste offre equipe candidature",
    fond: noir,
    elements: [
      rect(0, 0, 1080, 330, "#facc15"),
      texte("ON RECRUTE", 40, 100, 1000, 122, { police: "Archivo Black", couleur: noir }),
      texte("Vendeur ou vendeuse en boutique", 90, 390, 900, 56, { police: "Poppins", gras: true, couleur: blanc }),
      texte("CDI · 35 h · dès le 1er septembre", 90, 560, 900, 36, { couleur: "#d4d4d4" }),
      ...["Tu aimes le contact", "Tu es disponible le samedi", "Tu as le sens du détail"].flatMap((t, i) => [
        icone("check", 260, 650 + i * 76, 48, "#facc15", "tabler", { groupe: `point${i}`, trait: 3 }),
        texte(t, 330, 654 + i * 76, 600, 36, { couleur: blanc, alignement: "left", groupe: `point${i}` }),
      ]),
      texte("Envoie ton CV en message privé", 90, 950, 900, 38, { gras: true, couleur: "#facc15" }),
    ],
  },
];

// ---- Portrait 1080 × 1350 ----

const PORTRAITS: ModeleDepart[] = [
  {
    id: "produit-vedette",
    nom: "Produit en vedette",
    format: "portrait",
    mots: "produit vedette avantages prix boutique",
    fond: "#eef2f7",
    elements: [
      cadre("arrondi", 90, 90, 900, 640, { fond: "#d8dee8" }),
      texte("Le sac de voyage", 90, 770, 900, 76, { police: "DM Serif Display", couleur: "#0f172a" }),
      ...["Imperméable et léger", "Garanti deux ans", "Livré en 48 h"].flatMap((t, i) => [
        icone("circle-check", 300, 900 + i * 70, 44, "#2563eb", "tabler-plein", { groupe: `avantage${i}` }),
        texte(t, 362, 904 + i * 70, 560, 34, { couleur: "#334155", alignement: "left", groupe: `avantage${i}` }),
      ]),
      rect(340, 1150, 400, 100, "#2563eb", { arrondi: 50, groupe: "prix" }),
      texte("89 €", 340, 1170, 400, 56, { police: "Montserrat", gras: true, couleur: blanc, groupe: "prix" }),
    ],
  },
  {
    id: "carrousel-couverture",
    nom: "Couverture de carrousel",
    format: "portrait",
    mots: "carrousel couverture accroche erreurs conseils glisser",
    fond: degrade(110, "#fde68a", "#fca5a5"),
    elements: [
      texte("5 erreurs", 80, 230, 920, 190, { police: "Anton", couleur: noir, alignement: "left" }),
      texte("qui ruinent tes pubs", 80, 450, 920, 120, { police: "Anton", couleur: noir, alignement: "left", interligne: 1.0 }),
      texte("(et comment les éviter)", 80, 760, 920, 64, { police: "Caveat", couleur: noir, alignement: "left" }),
      texte("@tamarque", 80, 1222, 500, 32, { gras: true, couleur: noir, alignement: "left" }),
      texte("Glisse", 640, 1222, 280, 32, { gras: true, couleur: noir, alignement: "right", groupe: "glisse" }),
      icone("arrow-right", 935, 1214, 48, noir, "tabler", { groupe: "glisse", trait: 2.5 }),
    ],
  },
  {
    id: "comparatif",
    nom: "Comparatif",
    format: "portrait",
    mots: "comparatif tableau concurrence avantages pourquoi nous",
    fond: blanc,
    elements: [
      texte("Pourquoi nous choisir ?", 40, 110, 1000, 68, { police: "Poppins", gras: true }),
      texte("Ce qui change vraiment pour toi", 90, 215, 900, 36, { couleur: "#6b7280" }),
      tableau(
        [
          ["", "Nous", "Les autres"],
          ["Livraison", "24 h", "3 à 5 jours"],
          ["Retours", "Gratuits", "Payants"],
          ["Garantie", "2 ans", "1 an"],
          ["Service client", "7 j sur 7", "En semaine"],
        ],
        90,
        320,
        900,
        { police: "Poppins", taillePolice: 40, fondEntete: "#4f46e5", texteEntete: blanc, marge: 34, rayures: "#f5f3ff", bordure: { couleur: "#e5e7eb", epaisseur: 2 } },
      ),
      texte("Essaie sans risque pendant 30 jours", 90, 1150, 900, 42, { police: "Poppins", gras: true, couleur: "#4f46e5" }),
    ],
  },
  {
    id: "etapes",
    nom: "Comment ça marche",
    format: "portrait",
    mots: "etapes comment ca marche processus commande livraison",
    fond: "#ecfdf5",
    elements: [
      texte("Comment ça marche", 90, 90, 900, 80, { police: "Poppins", gras: true, couleur: "#064e3b" }),
      ...[
        ["hand-click", "1. Tu choisis", "Plus de 200 modèles, tous fabriqués en France."],
        ["truck-delivery", "2. On livre", "Chez toi en 48 h, sans frais dès 50 €."],
        ["gift", "3. Tu profites", "Satisfait ou remboursé pendant 30 jours."],
      ].flatMap(([nom, titre, detail], i) => {
        const y = 290 + i * 320;
        const g = `etape${i}`;
        return [
          rond(110, y, 150, 150, "#10b981", { groupe: g }),
          icone(nom, 147, y + 37, 76, blanc, "tabler", { groupe: g }),
          texte(titre, 310, y + 18, 680, 48, { police: "Poppins", gras: true, couleur: "#064e3b", alignement: "left", groupe: g }),
          texte(detail, 310, y + 84, 660, 32, { couleur: "#047857", alignement: "left", groupe: g }),
        ];
      }),
    ],
  },
  {
    id: "offre-speciale",
    nom: "Offre spéciale",
    format: "portrait",
    mots: "offre speciale code promo reduction premiere commande",
    fond: degrade(90, "#1e1b4b", "#4c1d95"),
    elements: [
      texte("OFFRE SPÉCIALE", 90, 130, 900, 66, { police: "Bebas Neue", couleur: "#fbbf24", espacement: 10 }),
      texte("-30 %", 60, 240, 960, 340, { police: "Anton", couleur: blanc }),
      texte("sur ta première commande", 90, 650, 900, 52, { police: "Poppins", couleur: blanc }),
      rect(240, 820, 600, 150, "#1e1b4b", { arrondi: 24, contour: "#fbbf24", epaisseurContour: 6, groupe: "code" }),
      texte("BIENVENUE30", 240, 864, 600, 58, { police: "Space Mono", gras: true, couleur: "#fbbf24", espacement: 4, groupe: "code" }),
      texte("Valable jusqu'au 31 mars", 90, 1060, 900, 32, { couleur: "#c4b5fd" }),
    ],
  },
  {
    id: "tarifs",
    nom: "Nos formules",
    format: "portrait",
    mots: "tarifs prix formules abonnement offres",
    fond: "#f8fafc",
    elements: [
      texte("Nos formules", 90, 80, 900, 80, { police: "Poppins", gras: true, couleur: "#0f172a" }),
      ...[
        ["Essentiel", "Pour découvrir", "9 €"],
        ["Pro", "Le plus choisi", "19 €"],
        ["Équipe", "Jusqu'à 10 personnes", "39 €"],
      ].flatMap(([nom, detail, prix], i) => {
        const y = 230 + i * 350;
        const fort = i === 1;
        const encre = fort ? blanc : "#0f172a";
        const g = `formule${i}`;
        return [
          rect(90, y, 900, 310, fort ? "#4f46e5" : blanc, { arrondi: 28, ombre: OMBRE_DOUCE, groupe: g }),
          texte(nom, 150, y + 70, 460, 52, { police: "Poppins", gras: true, couleur: encre, alignement: "left", groupe: g }),
          texte(detail, 150, y + 150, 460, 32, { couleur: fort ? "#e0e7ff" : "#64748b", alignement: "left", groupe: g }),
          texte(prix, 600, y + 60, 330, 96, { police: "Poppins", gras: true, couleur: encre, alignement: "right", groupe: g }),
          texte("par mois", 600, y + 180, 330, 28, { couleur: fort ? "#e0e7ff" : "#64748b", alignement: "right", groupe: g }),
        ];
      }),
    ],
  },
  {
    id: "bientot",
    nom: "Bientôt",
    format: "portrait",
    mots: "bientot teaser lancement annonce mystere",
    fond: "#0b0b0b",
    elements: [
      texte("BIENTÔT", 90, 130, 900, 72, { police: "Bebas Neue", couleur: "#a3e635", espacement: 24 }),
      cadre("cercle", 240, 270, 600, 600, { fond: "#262626", bordure: { couleur: "#a3e635", epaisseur: 8 } }),
      texte("Quelque chose de nouveau arrive", 90, 930, 900, 66, { police: "Syne", gras: true, couleur: blanc }),
      texte("Rendez-vous le 1er mars", 90, 1130, 900, 40, { couleur: "#a3e635" }),
    ],
  },
];

// ---- Story 1080 × 1920 ----

const STORIES: ModeleDepart[] = [
  {
    id: "vente-flash",
    nom: "Vente flash",
    format: "story",
    mots: "vente flash promo reduction 24h lien en bio",
    fond: degrade(90, "#ff0844", "#ffb199"),
    elements: [
      emoji("high-voltage", 390, 200, 300),
      texte("VENTE FLASH", 60, 560, 960, 170, { police: "Anton", couleur: blanc }),
      texte("-40 %", 60, 760, 960, 330, { police: "Anton", couleur: "#fff3b0" }),
      texte("24 h seulement", 90, 1140, 900, 64, { police: "Poppins", gras: true, couleur: blanc }),
      rect(240, 1450, 600, 120, blanc, { arrondi: 60, groupe: "bouton" }),
      texte("Lien en bio", 240, 1482, 600, 50, { police: "Poppins", gras: true, couleur: "#ff0844", groupe: "bouton" }),
    ],
  },
  {
    id: "questions",
    nom: "Pose-moi tes questions",
    format: "story",
    mots: "questions reponses communaute echange story",
    fond: degrade(110, "#a18cd1", "#fbc2eb"),
    elements: [
      emoji("speech-balloon", 420, 250, 240),
      texte("Pose-moi tes questions", 90, 560, 900, 112, { police: "Poppins", gras: true, couleur: blanc, interligne: 1.05 }),
      rect(140, 880, 800, 380, blanc, { arrondi: 40, opacite: 0.92 }),
      texte("Place ici l'autocollant Questions", 180, 1050, 720, 34, { couleur: "#9ca3af" }),
      texte("Je réponds à tout ce soir", 90, 1360, 900, 64, { police: "Caveat", couleur: blanc }),
    ],
  },
  {
    id: "nouveau-post",
    nom: "Nouveau post",
    format: "story",
    mots: "nouveau post publication profil partage",
    fond: "#fafafa",
    elements: [
      texte("NOUVEAU POST", 90, 210, 900, 120, { police: "Bebas Neue", espacement: 10, couleur: noir }),
      cadre("arrondi", 190, 420, 700, 875, { fond: "#e5e5e5", rotation: -3, ombre: { couleur: "#000000", flou: 40, x: 0, y: 20, opacite: 0.18 } }),
      emoji("backhand-index-pointing-down", 440, 1380, 200),
      texte("Va le voir sur mon profil", 90, 1640, 900, 54, { police: "Poppins", gras: true, couleur: noir }),
    ],
  },
  {
    id: "code-promo",
    nom: "Code promo",
    format: "story",
    mots: "code promo reduction bienvenue cadeau",
    fond: degrade(90, "#064e3b", "#10b981"),
    elements: [
      texte("Ton code promo", 90, 400, 900, 92, { police: "Poppins", gras: true, couleur: blanc }),
      rect(140, 630, 800, 220, blanc, { arrondi: 32, groupe: "code" }),
      texte("BIENVENUE10", 140, 694, 800, 88, { police: "Space Mono", gras: true, couleur: "#064e3b", groupe: "code" }),
      texte("-10 % sur ta première commande", 90, 940, 900, 52, { police: "Poppins", couleur: blanc }),
      icone("gift", 440, 1170, 200, blanc, "tabler", { trait: 1.6 }),
      texte("Valable jusqu'au 30 avril", 90, 1500, 900, 36, { couleur: "#d1fae5" }),
    ],
  },
  {
    id: "atelier-story",
    nom: "Atelier, date et lieu",
    format: "story",
    mots: "evenement atelier date inscription qr code",
    fond: "#1e293b",
    elements: [
      texte("14", 90, 220, 900, 400, { police: "Anton", couleur: "#f472b6" }),
      texte("JUIN", 90, 680, 900, 140, { police: "Bebas Neue", couleur: blanc, espacement: 30 }),
      texte("Atelier découverte", 90, 900, 900, 96, { police: "Playfair Display", gras: true, couleur: blanc }),
      texte("De 14 h à 17 h · Places limitées", 90, 1050, 900, 40, { couleur: "#cbd5e1" }),
      qr("https://", 390, 1230, 300, "#1e293b", blanc),
      texte("Inscris-toi", 90, 1580, 900, 46, { gras: true, couleur: "#f472b6" }),
    ],
  },
  {
    id: "compte-a-rebours",
    nom: "Compte à rebours",
    format: "story",
    mots: "compte a rebours jours lancement bientot notification",
    fond: "#000000",
    elements: [
      texte("J-3", 60, 460, 960, 560, { police: "Anton", couleur: "#facc15" }),
      texte("avant le lancement", 90, 1110, 900, 72, { police: "Poppins", gras: true, couleur: blanc }),
      texte("Active la notification pour ne rien rater", 140, 1260, 800, 40, { couleur: "#a3a3a3" }),
      emoji("alarm-clock", 440, 1450, 200),
    ],
  },
  {
    id: "temoignage-story",
    nom: "Avis client",
    format: "story",
    mots: "temoignage avis client etoiles story",
    fond: "#fff7ed",
    elements: [
      cadre("cercle", 340, 300, 400, 400, { fond: "#fed7aa" }),
      ...etoiles(540, 780, 90, 32, "#f59e0b"),
      texte("« J'ai enfin trouvé une crème qui ne pique pas. Je ne change plus. »", 100, 950, 880, 72, { police: "Fraunces", couleur: "#431407", interligne: 1.25 }),
      texte("Léa, 31 ans", 90, 1430, 900, 46, { police: "Montserrat", gras: true, couleur: "#c2410c" }),
      texte("Et toi, tu l'as essayée ?", 90, 1640, 900, 72, { police: "Caveat", couleur: "#431407" }),
    ],
  },
  {
    id: "sondage",
    nom: "Tu préfères ?",
    format: "story",
    mots: "sondage choix tu preferes question vote",
    fond: degrade(90, "#0ea5e9", "#6366f1"),
    elements: [
      texte("Tu préfères ?", 90, 150, 900, 112, { police: "Poppins", gras: true, couleur: blanc }),
      cadre("arrondi", 140, 360, 800, 620, { fond: "#bae6fd" }),
      rond(90, 330, 130, 130, blanc, { groupe: "a" }),
      texte("A", 90, 352, 130, 70, { police: "Poppins", gras: true, couleur: "#0ea5e9", groupe: "a" }),
      cadre("arrondi", 140, 1060, 800, 620, { fond: "#c7d2fe" }),
      rond(90, 1030, 130, 130, blanc, { groupe: "b" }),
      texte("B", 90, 1052, 130, 70, { police: "Poppins", gras: true, couleur: "#6366f1", groupe: "b" }),
      texte("Réponds avec le sondage", 90, 1760, 900, 42, { couleur: blanc, gras: true }),
    ],
  },
  {
    id: "citation-story",
    nom: "Citation en story",
    format: "story",
    mots: "citation phrase motivation inspiration story",
    fond: degrade(110, "#f6d365", "#fda085"),
    elements: [
      texte("“", 90, 280, 900, 420, { police: "Playfair Display", couleur: blanc }),
      texte("Commence avant d'être prêt : tu apprendras en chemin.", 120, 700, 840, 90, { police: "Playfair Display", gras: true, couleur: "#3b1f0b", interligne: 1.2 }),
      ligne(440, 1200, 200, "#3b1f0b", 6),
      texte("@tamarque", 90, 1250, 900, 42, { police: "Montserrat", gras: true, couleur: "#3b1f0b" }),
    ],
  },
];

// ---- Miniature vidéo 1280 × 720 ----

const MINIATURES: ModeleDepart[] = [
  {
    id: "tuto",
    nom: "Tuto en 5 minutes",
    format: "miniature",
    mots: "tuto tutoriel debutant miniature youtube video",
    fond: "#ffde59",
    elements: [
      cadre("goutte", 780, 60, 460, 600, { fond: "#e6c440" }),
      texte("TUTO", 60, 70, 700, 220, { police: "Anton", couleur: noir, alignement: "left" }),
      texte("EN 5 MIN", 60, 300, 700, 150, { police: "Anton", couleur: blanc, alignement: "left", contour: { couleur: noir, epaisseur: 12 } }),
      rect(60, 530, 420, 110, noir, { arrondi: 20, groupe: "niveau" }),
      texte("Débutant", 60, 556, 420, 56, { police: "Poppins", gras: true, couleur: "#ffde59", groupe: "niveau" }),
      icone("arrow-big-right", 600, 330, 150, "#e63946", "tabler-plein"),
    ],
  },
  {
    id: "top-5",
    nom: "Top 5",
    format: "miniature",
    mots: "top classement liste meilleurs outils miniature",
    fond: radial("#1f2937", "#000000"),
    elements: [
      texte("TOP 5", 60, 70, 700, 300, { police: "Anton", couleur: "#facc15", alignement: "left" }),
      texte("des outils gratuits pour créer tes vidéos", 60, 420, 660, 56, { police: "Poppins", gras: true, couleur: blanc, alignement: "left" }),
      cadre("arrondi", 760, 70, 460, 580, { fond: "#374151" }),
      emoji("star-struck", 1060, 520, 170),
    ],
  },
  {
    id: "avant-apres-miniature",
    nom: "Avant, après (vidéo)",
    format: "miniature",
    mots: "avant apres transformation resultat miniature",
    fond: blanc,
    elements: [
      cadre("rectangle", 0, 0, 640, 720, { fond: "#d4d4d4" }),
      cadre("rectangle", 640, 0, 640, 720, { fond: "#bdbdbd" }),
      rect(40, 40, 240, 84, noir, { arrondi: 42, groupe: "avant" }),
      texte("AVANT", 40, 54, 240, 50, { police: "Anton", couleur: blanc, groupe: "avant" }),
      rect(1000, 40, 240, 84, "#ef4444", { arrondi: 42, groupe: "apres" }),
      texte("APRÈS", 1000, 54, 240, 50, { police: "Anton", couleur: blanc, groupe: "apres" }),
      rond(560, 280, 160, 160, "#facc15", { groupe: "fleche" }),
      icone("arrow-right", 590, 310, 100, noir, "tabler", { groupe: "fleche", trait: 3 }),
      rect(440, 560, 400, 120, noir, { arrondi: 24, groupe: "duree" }),
      texte("30 JOURS", 440, 572, 400, 84, { police: "Anton", couleur: "#facc15", groupe: "duree" }),
    ],
  },
  {
    id: "vlog",
    nom: "Une journée avec moi",
    format: "miniature",
    mots: "vlog journee quotidien routine miniature",
    fond: degrade(120, "#f9a8d4", "#c4b5fd"),
    elements: [
      cadre("arrondi", 60, 60, 600, 600, { fond: "#e9d5ff", bordure: { couleur: blanc, epaisseur: 12 } }),
      texte("Une journée", 700, 120, 540, 104, { police: "Pacifico", couleur: blanc, alignement: "left" }),
      texte("avec moi", 700, 290, 540, 104, { police: "Pacifico", couleur: "#4c1d95", alignement: "left" }),
      emoji("hot-beverage", 720, 480, 140),
      emoji("sparkles", 900, 500, 120),
    ],
  },
  {
    id: "question-miniature",
    nom: "Ça marche vraiment ?",
    format: "miniature",
    mots: "question test avis verite miniature",
    fond: "#0f172a",
    elements: [
      texte("ÇA MARCHE", 60, 100, 720, 160, { police: "Anton", couleur: blanc, alignement: "left" }),
      texte("VRAIMENT ?", 60, 280, 720, 160, { police: "Anton", couleur: "#22d3ee", alignement: "left" }),
      emoji("thinking-face", 60, 490, 180),
      cadre("arrondi", 800, 60, 420, 600, { fond: "#1e293b", bordure: { couleur: "#22d3ee", epaisseur: 8 } }),
    ],
  },
];

// ---- Bannière 1500 × 500 ----

const BANNIERES: ModeleDepart[] = [
  {
    id: "banniere-pro",
    nom: "Bannière de profil",
    format: "banniere",
    mots: "banniere profil en-tete nom metier createur",
    fond: "#0f172a",
    elements: [
      rond(1080, -260, 640, 640, "#1e3a8a"),
      rond(1260, 230, 380, 380, "#38bdf8", { opacite: 0.55 }),
      texte("Ton nom", 100, 110, 900, 116, { police: "Space Grotesk", gras: true, couleur: blanc, alignement: "left" }),
      texte("Graphiste et créateur de contenu", 100, 262, 900, 44, { couleur: "#cbd5e1", alignement: "left" }),
      texte("Nouvelle vidéo chaque mardi", 100, 350, 900, 32, { gras: true, couleur: "#38bdf8", alignement: "left" }),
    ],
  },
  {
    id: "banniere-soldes",
    nom: "Bannière soldes",
    format: "banniere",
    mots: "banniere soldes promotion site boutique",
    fond: degrade(0, "#ef4444", "#f97316"),
    elements: [
      texte("SOLDES", 80, 100, 700, 250, { police: "Anton", couleur: blanc, alignement: "left" }),
      texte("jusqu'à -60 %", 800, 140, 640, 104, { police: "Anton", couleur: "#fff3b0", alignement: "left" }),
      texte("En boutique et en ligne", 800, 280, 640, 44, { police: "Poppins", couleur: blanc, alignement: "left" }),
    ],
  },
  {
    id: "banniere-recettes",
    nom: "Bannière de chaîne",
    format: "banniere",
    mots: "banniere chaine recettes cuisine youtube rendez-vous",
    fond: "#fef9c3",
    elements: [
      { ...rond(1170, 70, 300, 300, "#facc15"), forme: "etoile", cotes: 14 },
      emoji("croissant", 1220, 120, 200),
      texte("Recettes faciles", 100, 110, 1000, 124, { police: "Shrikhand", couleur: "#9a3412", alignement: "left" }),
      texte("Une nouvelle recette chaque dimanche", 100, 300, 1000, 44, { police: "Poppins", couleur: "#7c2d12", alignement: "left" }),
    ],
  },
];

// ---- Paysage 1920 × 1080 ----

const PAYSAGES: ModeleDepart[] = [
  {
    id: "presentation-titre",
    nom: "Titre de présentation",
    format: "paysage",
    mots: "presentation titre diaporama bilan reunion",
    fond: "#f8fafc",
    elements: [
      rect(0, 0, 760, 1080, "#4f46e5"),
      texte("2026", 100, 120, 560, 60, { police: "Space Grotesk", gras: true, couleur: "#c7d2fe", alignement: "left" }),
      texte("Bilan de l'année", 100, 360, 600, 136, { police: "Space Grotesk", gras: true, couleur: blanc, alignement: "left", interligne: 1.0 }),
      texte("Ce qui a marché, ce qu'on change", 100, 720, 560, 44, { couleur: "#e0e7ff", alignement: "left" }),
      cadre("arrondi", 900, 140, 920, 800, { fond: "#e2e8f0" }),
    ],
  },
  {
    id: "diapo-chiffres",
    nom: "Diapositive de chiffres",
    format: "paysage",
    mots: "presentation chiffres ventes graphique trimestre bilan",
    fond: blanc,
    elements: [
      texte("Ventes par trimestre", 120, 80, 1100, 80, { police: "Poppins", gras: true, alignement: "left", couleur: "#0f172a" }),
      graphique("colonnes", 100, 220, 1140, 760, {
        police: "Poppins",
        taillePolice: 30,
        etiquettes: ["T1", "T2", "T3", "T4"],
        series: [
          { nom: "2025", couleur: "#c7d2fe", valeurs: [40, 55, 62, 80] },
          { nom: "2026", couleur: "#4f46e5", valeurs: [52, 70, 78, 104] },
        ],
        unite: "k€",
        legende: true,
        valeurs: false,
        grille: true,
      }),
      texte("+30 %", 1350, 300, 470, 150, { police: "Anton", couleur: "#4f46e5", alignement: "left" }),
      texte("de ventes en un an", 1350, 480, 470, 40, { alignement: "left", couleur: "#475569" }),
      texte("104 k€", 1350, 620, 470, 130, { police: "Anton", couleur: "#f59e0b", alignement: "left" }),
      texte("au dernier trimestre", 1350, 780, 470, 40, { alignement: "left", couleur: "#475569" }),
    ],
  },
];

// ---- A4 2480 × 3508 et A5 1748 × 2480 ----

const IMPRIMES: ModeleDepart[] = [
  {
    id: "affiche-festival",
    nom: "Affiche de festival",
    format: "a4",
    mots: "affiche festival evenement concert date lieu",
    fond: degrade(100, "#1a1a2e", "#e94560"),
    elements: [
      texte("FESTIVAL", 160, 260, 2160, 420, { police: "Anton", couleur: blanc, espacement: 24 }),
      texte("des jeunes créateurs", 160, 760, 2160, 170, { police: "Playfair Display", italique: true, couleur: "#ffd6e0" }),
      cadre("arrondi", 360, 1080, 1760, 1300, { fond: "#2a2a40" }),
      texte("12 & 13 JUILLET", 160, 2500, 2160, 210, { police: "Bebas Neue", couleur: blanc, espacement: 24 }),
      texte("Parc des Lilas · Entrée gratuite", 160, 2780, 2160, 90, { police: "Poppins", couleur: "#ffd6e0" }),
      texte("Tout le programme", 160, 3150, 1700, 84, { police: "Poppins", gras: true, couleur: blanc, alignement: "left" }),
      qr("https://", 2040, 3020, 300, "#1a1a2e", blanc),
    ],
  },
  {
    id: "flyer-promo",
    nom: "Flyer promotion",
    format: "a4",
    mots: "flyer promotion reduction collection boutique imprime",
    fond: "#fffbeb",
    elements: [
      rect(0, 0, 2480, 1300, "#f59e0b"),
      texte("-20 %", 160, 200, 2160, 760, { police: "Anton", couleur: blanc }),
      texte("sur toute la nouvelle collection", 160, 1020, 2160, 120, { police: "Poppins", gras: true, couleur: "#78350f" }),
      cadre("arrondi", 260, 1460, 1960, 1240, { fond: "#fde68a" }),
      texte("Du 1er au 15 mai, en boutique", 160, 2860, 2160, 112, { police: "Poppins", gras: true, couleur: "#78350f" }),
      texte("12 avenue du Port · Ouvert 7 j sur 7", 160, 3060, 2160, 80, { couleur: "#92400e" }),
    ],
  },
  {
    id: "affiche-atelier",
    nom: "Affiche d'atelier",
    format: "a4",
    mots: "affiche atelier cours inscription horaires",
    fond: "#ecfeff",
    elements: [
      texte("Atelier", 160, 240, 2160, 300, { police: "Pacifico", couleur: "#0e7490" }),
      texte("CÉRAMIQUE", 100, 660, 2280, 270, { police: "Archivo Black", couleur: "#164e63" }),
      cadre("cercle", 640, 1100, 1200, 1200, { fond: "#a5f3fc" }),
      texte("Tous les mercredis, de 18 h à 20 h", 160, 2460, 2160, 110, { police: "Poppins", gras: true, couleur: "#155e75" }),
      texte("Matériel fourni · 6 personnes par séance", 160, 2640, 2160, 80, { couleur: "#0e7490" }),
      rect(740, 2980, 1000, 200, "#0e7490", { arrondi: 100, groupe: "bouton" }),
      texte("Réserve ta place", 740, 3030, 1000, 90, { police: "Poppins", gras: true, couleur: blanc, groupe: "bouton" }),
    ],
  },
  {
    id: "portes-ouvertes",
    nom: "Portes ouvertes",
    format: "a5",
    mots: "flyer portes ouvertes visite invitation imprime",
    fond: "#f5f3ff",
    elements: [
      texte("PORTES", 120, 180, 1508, 320, { police: "Anton", couleur: "#4c1d95" }),
      texte("OUVERTES", 120, 500, 1508, 320, { police: "Anton", couleur: "#7c3aed" }),
      cadre("arrondi", 220, 900, 1308, 900, { fond: "#ddd6fe" }),
      texte("Samedi 21 septembre, de 10 h à 18 h", 120, 1900, 1508, 80, { police: "Poppins", gras: true, couleur: "#4c1d95" }),
      texte("Visites, démonstrations et goûter offert", 120, 2040, 1508, 60, { couleur: "#6d28d9" }),
      emoji("balloon", 1420, 2180, 220),
    ],
  },
];

export const MODELES_DEPART: ModeleDepart[] = [...CARRES, ...PORTRAITS, ...STORIES, ...MINIATURES, ...BANNIERES, ...PAYSAGES, ...IMPRIMES];
