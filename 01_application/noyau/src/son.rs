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

/// Une voix parle-t-elle à l'instant `t` ? De 0 à 1 (`sauf` : un clip à ne pas compter).
pub fn presence_voix(sons: &[ClipAudio], t: f64, sauf: Option<&str>) -> f64 {
    let mut p: f64 = 0.0;
    for v in sons {
        if v.role != "voix" || Some(v.id.as_str()) == sauf || v.volume.unwrap_or(1.0) <= 0.0 {
            continue;
        }
        let (debut, fin) = (v.temps.debut, v.temps.fin);
        let x = if t < debut - ATTAQUE_VOIX || t >= fin + RELACHE_VOIX {
            0.0
        } else if t < debut {
            (t - (debut - ATTAQUE_VOIX)) / ATTAQUE_VOIX
        } else if t < fin {
            1.0
        } else {
            1.0 - (t - fin) / RELACHE_VOIX
        };
        p = p.max(x);
    }
    borne(p)
}

/// Le volume d'un son à l'instant `t` : son volume, ses fondus, la baisse sous la voix.
pub fn gain_clip_son(c: &ClipAudio, t: f64, sons: &[ClipAudio]) -> f64 {
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
        v *= 1.0 - (1.0 - borne(c.sous_la_voix.unwrap_or(SOUS_LA_VOIX))) * presence_voix(sons, t, Some(&c.id));
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
            for (nom, calcule) in [("media", temps_media_son(&son, t, duree)), ("presence", presence_voix(&sons, t, Some(&son.id))), ("gain", gain_clip_son(&son, t, &sons))] {
                let attendu = c[nom].as_f64().unwrap();
                if (calcule - attendu).abs() > 2e-6 {
                    ecarts.push(format!("cas {i} ({} à {t}) : {nom} {calcule} au lieu de {attendu}", son.id));
                }
            }
        }
        assert!(ecarts.is_empty(), "{}", ecarts.join("\n"));
    }
}
