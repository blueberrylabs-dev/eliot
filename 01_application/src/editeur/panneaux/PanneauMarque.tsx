// Le panneau Marque : le kit de marque, un seul, gardé d'un design à l'autre. Ses couleurs
// s'appliquent d'un clic aux objets choisis (ou au fond de la page) ; ses polices servent aux
// titres et aux textes posés d'ici ; ses logos se posent comme une image.

import { ImagePlus, Plus, X } from "lucide-react";
import { useEffect, useState, type PointerEvent as PointeurReact } from "react";
import { elementsSelectionnes, useEditeur } from "../../etat/editeur";
import { logoDansDesign, useMarque } from "../../etat/marque";
import { copierPoliceDansDesign } from "../../etat/projets";
import { creerImage, creerTexte } from "../../modele/fabriques";
import { COULEURS_MAX, modifCouleur, ROLES_POLICE, type RolePolice } from "../../modele/marque";
import { REF_MARQUE, type Couleur, type ElementPage, type Format, type Ressource } from "../../modele/types";
import { urlRessource } from "../../pont/tauri";
import { assurerPolice, pilePolice, POLICE_PAR_DEFAUT } from "../../polices";
import { Bulle } from "../Bulle";
import { glisserDepuisPanneau } from "../glisser";
import { SelecteurPolice } from "../SelecteurPolice";

const TEXTES: Record<RolePolice, string> = { titre: "Ajouter un titre", sousTitre: "Ajouter un sous-titre", texte: "Ajouter un paragraphe de texte" };

/** Donne une couleur aux objets choisis ; sans sélection, au fond de la page. */
export function appliquerCouleurMarque(couleur: string): void {
  const etat = useEditeur.getState();
  const choisis = elementsSelectionnes(etat).filter((e) => !e.verrouille);
  if (choisis.length === 0) {
    etat.modifierFond(couleur);
    return;
  }
  const modifs: Record<string, Partial<ElementPage>> = {};
  for (const el of choisis) {
    const m = modifCouleur(el, couleur);
    if (m) modifs[el.id] = m;
  }
  if (Object.keys(modifs).length) etat.modifierElements(modifs);
}

/** Les couleurs unies du design ouvert (fond, textes, formes, icônes). */
function couleursDuDesign(): string[] {
  const vues = new Set<string>();
  const ajouter = (c: Couleur | undefined) => {
    if (!c) return;
    (typeof c === "string" ? [c] : c.arrets.map((a) => a.couleur)).forEach((x) => /^#[0-9a-f]{6}$/i.test(x) && vues.add(x.toLowerCase()));
  };
  for (const page of useEditeur.getState().document.pages) {
    ajouter(page.fond);
    for (const e of page.elements) {
      if (e.type === "texte" || e.type === "icone" || e.type === "qr") ajouter(e.couleur);
      if (e.type === "forme") ajouter(e.forme === "ligne" || e.forme === "fleche" ? e.contour : e.remplissage);
    }
  }
  return [...vues];
}

/** Un texte écrit dans la police de la marque pour ce rôle, en sa première couleur. */
async function texteDeMarque(format: Format, role: RolePolice): Promise<ElementPage[]> {
  const { kit } = useMarque.getState();
  const r = ROLES_POLICE.find((x) => x.id === role)!;
  const police = kit.polices[role]?.famille ?? POLICE_PAR_DEFAUT;
  const gras = kit.polices[role]?.gras ?? r.gras;
  await assurerPolice(police, gras, false);
  void copierPoliceDansDesign(police);
  const echelle = Math.max(format.largeur, format.hauteur) / 1080;
  const couleur = role === "texte" ? undefined : kit.couleurs[0]?.valeur;
  return [creerTexte(format, { texte: TEXTES[role], taillePolice: Math.round(r.taille * echelle), gras, police, ...(couleur ? { couleur } : {}) })];
}

function CarteLogo({ ressource }: { ressource: Ressource }) {
  const [url, setUrl] = useState<string | null>(null);
  const retirer = useMarque((s) => s.retirerLogo);
  useEffect(() => {
    let actif = true;
    urlRessource(REF_MARQUE, ressource.id, "miniature").then((u) => actif && setUrl(u), () => undefined);
    return () => {
      actif = false;
    };
  }, [ressource.id]);

  const debut = (e: PointeurReact<HTMLButtonElement>) => {
    let promesse: Promise<Ressource> | null = null;
    const copier = () => {
      promesse ??= logoDansDesign(ressource.id);
      promesse.catch((erreur) => useEditeur.getState().notifier(`Logo non posé : ${String(erreur)}`, { erreur: true }));
      return promesse;
    };
    glisserDepuisPanneau(e, async (format) => {
      try {
        return [creerImage(format, await copier())];
      } catch {
        return [];
      }
    });
  };

  return (
    <div className="group relative">
      <button
        title={ressource.nom}
        onPointerDown={debut}
        className="flex h-20 w-full cursor-grab items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-2 hover:border-accent-500"
      >
        {url && <img src={url} alt={ressource.nom} draggable={false} className="max-h-full max-w-full object-contain" />}
      </button>
      <button title="Retirer du kit (le fichier reste dans le dossier du kit)" onClick={() => retirer(ressource.id)} className="absolute -top-1.5 -right-1.5 hidden rounded-full border border-neutral-300 bg-white p-0.5 text-neutral-600 shadow-sm group-hover:block hover:text-red-600">
        <X size={12} />
      </button>
    </div>
  );
}

export function PanneauMarque() {
  const kit = useMarque((s) => s.kit);
  const images = useMarque((s) => s.images);
  const modifier = useMarque((s) => s.modifier);
  const importerLogos = useMarque((s) => s.importerLogos);
  const [nouvelle, setNouvelle] = useState("#1f6feb");
  const [occupe, setOccupe] = useState(false);

  const ajouterCouleurs = (liste: string[]) =>
    modifier((k) => ({ ...k, couleurs: [...k.couleurs, ...liste.filter((v) => !k.couleurs.some((c) => c.valeur === v)).map((valeur) => ({ valeur }))].slice(0, COULEURS_MAX) }));

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-neutral-800">Kit de marque</p>
      <input
        value={kit.nom}
        onChange={(e) => modifier((k) => ({ ...k, nom: e.target.value }))}
        title="Nom de la marque"
        className="mb-4 h-9 w-full rounded-lg border border-neutral-300 px-2.5 text-sm font-medium outline-none focus:border-accent-500"
      />

      <p className="mb-1 text-sm font-semibold text-neutral-800">Couleurs</p>
      <p className="mb-2 text-xs text-neutral-500">Un clic donne la couleur aux objets choisis, ou au fond de la page si rien n'est choisi.</p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {kit.couleurs.map((c) => (
          <div key={c.valeur} className="group relative">
            <button data-couleur-marque={c.valeur} title={c.nom ?? c.valeur} onClick={() => appliquerCouleurMarque(c.valeur)} className="h-9 w-9 rounded-lg border border-neutral-300" style={{ background: c.valeur }} />
            <button
              title="Retirer du kit"
              onClick={() => modifier((k) => ({ ...k, couleurs: k.couleurs.filter((x) => x.valeur !== c.valeur) }))}
              className="absolute -top-1.5 -right-1.5 hidden rounded-full border border-neutral-300 bg-white p-0.5 text-neutral-600 shadow-sm group-hover:block hover:text-red-600"
            >
              <X size={11} />
            </button>
          </div>
        ))}
        {kit.couleurs.length < COULEURS_MAX && (
          <Bulle titre="Ajouter une couleur" largeur={220} classeBouton="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-neutral-400 text-neutral-500 hover:border-accent-500 hover:text-accent-700" bouton={<Plus size={16} />}>
            <div className="flex items-center gap-2">
              <input type="color" value={/^#[0-9a-f]{6}$/i.test(nouvelle) ? nouvelle : "#000000"} onChange={(e) => setNouvelle(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-neutral-300" aria-label="Nouvelle couleur" />
              <input
                value={nouvelle}
                onChange={(e) => setNouvelle(e.target.value.trim())}
                aria-label="Code de la couleur"
                className={`h-8 w-24 rounded-md border px-2 font-mono text-xs outline-none ${/^#[0-9a-f]{6}$/i.test(nouvelle) ? "border-neutral-300 focus:border-accent-500" : "border-red-400"}`}
              />
              <button disabled={!/^#[0-9a-f]{6}$/i.test(nouvelle)} onClick={() => ajouterCouleurs([nouvelle.toLowerCase()])} className="h-8 rounded-md bg-accent-600 px-2 text-xs font-medium text-white hover:bg-accent-700 disabled:opacity-50">
                Ajouter
              </button>
            </div>
          </Bulle>
        )}
      </div>
      <button onClick={() => ajouterCouleurs(couleursDuDesign())} className="mb-5 text-xs font-medium text-accent-700 hover:underline">
        Reprendre les couleurs du design ouvert
      </button>

      <p className="mb-2 text-sm font-semibold text-neutral-800">Polices</p>
      <div className="mb-3 flex flex-col gap-2">
        {ROLES_POLICE.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2">
            <span className="text-xs text-neutral-600">{r.libelle}</span>
            <SelecteurPolice valeur={kit.polices[r.id]?.famille ?? POLICE_PAR_DEFAUT} surChoix={(famille) => modifier((k) => ({ ...k, polices: { ...k.polices, [r.id]: { famille } } }))} />
          </div>
        ))}
      </div>
      <div className="mb-5 flex flex-col gap-1.5">
        {ROLES_POLICE.map((r) => {
          const famille = kit.polices[r.id]?.famille ?? POLICE_PAR_DEFAUT;
          return (
            <button
              key={r.id}
              data-texte-marque={r.id}
              onPointerEnter={() => void assurerPolice(famille, kit.polices[r.id]?.gras ?? r.gras, false)}
              onPointerDown={(e) => glisserDepuisPanneau(e, (f) => texteDeMarque(f, r.id))}
              className="w-full cursor-grab rounded-lg border border-neutral-200 px-3 py-2 text-left hover:border-accent-500 hover:bg-accent-50"
              style={{ fontFamily: pilePolice(famille), fontWeight: (kit.polices[r.id]?.gras ?? r.gras) ? 700 : 400, fontSize: r.id === "titre" ? 22 : r.id === "sousTitre" ? 17 : 13, color: r.id === "texte" ? undefined : kit.couleurs[0]?.valeur }}
            >
              {TEXTES[r.id]}
            </button>
          );
        })}
      </div>

      <p className="mb-2 text-sm font-semibold text-neutral-800">Logos</p>
      <button
        disabled={occupe}
        onClick={() => {
          setOccupe(true);
          importerLogos()
            .catch((e) => useEditeur.getState().notifier(`Import impossible : ${String(e)}`, { erreur: true }))
            .finally(() => setOccupe(false));
        }}
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-60"
      >
        <ImagePlus size={16} /> {occupe ? "Import en cours…" : "Importer un logo"}
      </button>
      {kit.logos.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">{kit.logos.map((id) => images[id] && <CarteLogo key={id} ressource={images[id]} />)}</div>
      ) : (
        <p className="text-xs text-neutral-500">PNG avec transparence de préférence. Le kit est rangé dans Documents, Eliot, Marque ; il sert à tous les designs.</p>
      )}
    </div>
  );
}
