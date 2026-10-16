//! Les sons d'une page vidéo (étape 4, lot 5), pour l'export : les mêmes formules que
//! `src/modele/son.ts`, écrites une seconde fois. Le tableau commun `src/modele/son.attendus.json`
//! (calculé par l'interface) est relu par les tests : les deux côtés doivent tomber sur les
//! mêmes valeurs, à un millionième près.
//!
//! La musique baisse toute seule pendant les clips de voix ; une musique « jusqu'à la fin » ou un
//! son qui boucle reprend sa partie jouée chaque fois qu'il l'a finie.

use serde::Deserialize;

use crate::animation::Temps;

/// La part du volume d'une musique gardée sous une voix.
pub const SOUS_LA_VOIX: f64 = 0.3;
pub const ATTAQUE_VOIX: f64 = 200.0;
pub const RELACHE_VOIX: f64 = 400.0;

#[derive(Debug, Clone, Copy, Default, Deserialize, PartialEq)]
pub struct Coupe {
    pub debut: f64,
    pub fin: Option<f64>,
}

/// Un son de la page (seuls les champs utiles au mixage).
#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ClipAudio {
    pub id: String,
    pub ressource: String,
    pub temps: Temps,
    #[serde(default)]
    pub piste: f64,
    pub coupe: Option<Coupe>,
    pub volume: Option<f64>,
    pub fondu_entree: Option<f64>,
    pub fondu_sortie: Option<f64>,
    #[serde(default = "bruitage")]
    pub role: String,
    #[serde(default)]
    pub boucle: bool,
    #[serde(default, rename = "jusquALaFin")]
    pub jusqu_a_la_fin: bool,
    pub phase: Option<f64>,
    pub sous_la_voix: Option<f64>,
    /// Le nettoyage de la voix (lot 6) : l'export lit alors la version nettoyée du fichier.
    #[serde(default)]
    pub nettoyage: Option<crate::voix::Nettoyage>,
}

fn bruitage() -> String {
    "bruitage".into()
}

fn borne(v: f64) -> f64 {
    v.clamp(0.0, 1.0)
}

impl ClipAudio {
    pub fn boucle(&self) -> bool {
        self.boucle || self.jusqu_a_la_fin
    }

    pub fn est_musique(&self) -> bool {
        self.role == "musique"
    }

    pub fn actif_a(&self, t: f64) -> bool {
        t >= self.temps.debut && t < self.temps.fin
    }

    /// La partie du fichier qui joue, en ms du fichier.
    pub fn partie_jouee(&self, duree_fichier: Option<f64>) -> (f64, f64) {
        let coupe = self.coupe.unwrap_or_default();
        let debut = coupe.debut.max(0.0);
        let fin = coupe.fin.unwrap_or(f64::INFINITY).min(duree_fichier.unwrap_or(f64::INFINITY));
        (debut, fin.max(debut))
    }
}

/// L'instant du fichier (ms) joué à l'instant `t` de la page.
pub fn temps_media_son(c: &ClipAudio, t: f64, duree_fichier: Option<f64>) -> f64 {
    let (debut, fin) = c.partie_jouee(duree_fichier);
    let depuis = t - c.temps.debut;
    let longueur = fin - debut;
    if c.boucle() && longueur > 0.0 && longueur.is_finite() {
        // Reste au sens de JavaScript (signe du dividende), puis ramené dans [0, longueur).
        let x = (depuis + c.phase.unwrap_or(0.0)) % longueur;
        return debut + if x < 0.0 { x + longueur } else { x };
    }
    (debut + depuis).clamp(debut, fin)
}

/// Deux passages de parole d'une vidéo à moins de 1,2 s l'un de l'autre n'en font qu'un : la
/// musique ne remonte pas entre deux phrases.
pub const FUSION_PAROLE: f64 = 1200.0;

/// Une vidéo de la page, pour la baisse de la musique : son temps dans la page, sa coupe, sa
/// vitesse et les passages où l'on parle dans son fichier (ms).
pub struct ClipQuiParle<'a> {
    pub debut: f64,
    pub fin: f64,
    pub coupe_debut: f64,
    pub vitesse: f64,
    pub parole: &'a [[u64; 2]],
}

/// Où l'on parle dans les vidéos d'une page, en ms de la page : chaque passage mis à sa place
/// (coupe, vitesse), dans le temps du clip, ceux à moins de `FUSION_PAROLE` réunis. Les mêmes
/// règles que `parolesDesClips` de la fenêtre (décision d'Alexandre du 2026-10-16).
pub fn paroles_des_clips(clips: &[ClipQuiParle]) -> Vec<[f64; 2]> {
    let mut bruts: Vec<[f64; 2]> = Vec::new();
    for c in clips {
        let vitesse = c.vitesse.clamp(0.25, 4.0);
        for p in c.parole {
            let debut = c.debut.max(c.debut + (p[0] as f64 - c.coupe_debut) / vitesse);
            let fin = c.fin.min(c.debut + (p[1] as f64 - c.coupe_debut) / vitesse);
            if fin > debut {
                bruts.push([debut, fin]);
            }
        }
    }
    bruts.sort_by(|a, b| a[0].total_cmp(&b[0]).then(a[1].total_cmp(&b[1])));
    let mut sortie: Vec<[f64; 2]> = Vec::new();
    for [debut, fin] in bruts {
        match sortie.last_mut() {
            Some(d) if debut - d[1] < FUSION_PAROLE => d[1] = d[1].max(fin),
            _ => sortie.push([debut, fin]),
        }
    }
    sortie
}

/// La présence d'une voix de `debut` à `fin` à l'instant `t`, de 0 à 1.
fn presence(debut: f64, fin: f64, t: f64) -> f64 {
    if t < debut - ATTAQUE_VOIX || t >= fin + RELACHE_VOIX {
        0.0
    } else if t < debut {
        (t - (debut - ATTAQUE_VOIX)) / ATTAQUE_VOIX
    } else if t < fin {
        1.0
    } else {
        1.0 - (t - fin) / RELACHE_VOIX
    }
}

/// Une voix parle-t-elle à l'instant `t` ? De 0 à 1 (`sauf` : un clip à ne pas compter).
/// `paroles` : où l'on parle dans les vidéos de la page (`paroles_des_clips`).
pub fn presence_voix(sons: &[ClipAudio], t: f64, sauf: Option<&str>, paroles: &[[f64; 2]]) -> f64 {
    let mut p: f64 = 0.0;
    for v in sons {
        if v.role != "voix" || Some(v.id.as_str()) == sauf || v.volume.unwrap_or(1.0) <= 0.0 {
            continue;
        }
        p = p.max(presence(v.temps.debut, v.temps.fin, t));
    }
    for [debut, fin] in paroles {
        p = p.max(presence(*debut, *fin, t));
    }
    borne(p)
}

/// Le volume d'un son à l'instant `t` : son volume, ses fondus, la baisse sous la voix et sous
/// la parole des vidéos.
pub fn gain_clip_son(c: &ClipAudio, t: f64, sons: &[ClipAudio], paroles: &[[f64; 2]]) -> f64 {
    let mut v = c.volume.unwrap_or(1.0);
    let tr = t - c.temps.debut;
    let longueur = c.temps.fin - c.temps.debut;
    let fi = c.fondu_entree.unwrap_or(0.0);
    let fo = c.fondu_sortie.unwrap_or(0.0);
    if fi > 0.0 && tr < fi {
        v *= borne(tr / fi);
    }
    if fo > 0.0 && tr > longueur - fo {
        v *= borne((longueur - tr) / fo);
    }
    if c.est_musique() {
        v *= 1.0 - (1.0 - borne(c.sous_la_voix.unwrap_or(SOUS_LA_VOIX))) * presence_voix(sons, t, Some(&c.id), paroles);
    }
    borne(v)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    const ATTENDUS: &str = include_str!("../../src/modele/son.attendus.json");

    #[test]
    fn les_formules_retrouvent_le_tableau_commun() {
        let tableau: Value = serde_json::from_str(ATTENDUS).unwrap();
        let cas = tableau["cas"].as_array().unwrap();
        assert!(cas.len() >= 60, "{} cas seulement", cas.len());
        let mut ecarts = Vec::new();
        for (i, c) in cas.iter().enumerate() {
            let son: ClipAudio = serde_json::from_value(c["son"].clone()).unwrap();
            let voix: Vec<ClipAudio> = serde_json::from_value(c["voix"].clone()).unwrap();
            let t = c["t"].as_f64().unwrap();
            let duree = c["dureeFichier"].as_f64();
            let mut sons = vec![son.clone()];
            sons.extend(voix);
            let paroles: Vec<[f64; 2]> = serde_json::from_value(c.get("paroles").cloned().unwrap_or(Value::Array(vec![]))).unwrap();
            for (nom, calcule) in [("media", temps_media_son(&son, t, duree)), ("presence", presence_voix(&sons, t, Some(&son.id), &paroles)), ("gain", gain_clip_son(&son, t, &sons, &paroles))] {
                let attendu = c[nom].as_f64().unwrap();
                if (calcule - attendu).abs() > 2e-6 {
                    ecarts.push(format!("cas {i} ({} à {t}) : {nom} {calcule} au lieu de {attendu}", son.id));
                }
            }
        }
        assert!(ecarts.is_empty(), "{}", ecarts.join("\n"));
    }

    #[test]
    fn les_paroles_des_clips() {
        // Les mêmes cas que dans `src/modele/son.test.ts`.
        let parole = [[3000, 4000], [5000, 6200], [9000, 11000], [16000, 20000]];
        let clip = ClipQuiParle { debut: 1000.0, fin: 8000.0, coupe_debut: 2000.0, vitesse: 2.0, parole: &parole };
        assert_eq!(paroles_des_clips(&[clip]), vec![[1500.0, 3100.0], [4500.0, 5500.0]]);
        let (a, b) = ([[0, 1500]], [[300, 1000]]);
        let deux = [ClipQuiParle { debut: 0.0, fin: 2000.0, coupe_debut: 0.0, vitesse: 1.0, parole: &a }, ClipQuiParle { debut: 2000.0, fin: 4000.0, coupe_debut: 0.0, vitesse: 1.0, parole: &b }];
        assert_eq!(paroles_des_clips(&deux), vec![[0.0, 3000.0]]);
    }
}
