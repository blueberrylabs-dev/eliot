//! Le mot prononcé des sous-titres (étape 4, lot 7), pour l'export : les deux formules de
//! `src/modele/sousTitres.ts`, écrites une seconde fois. Le tableau commun
//! `src/modele/sousTitres.attendus.json` (calculé par l'interface) est relu par les tests : les
//! deux côtés mettent le même mot en valeur au même instant.

use serde::Deserialize;

/// Le début et la fin d'un mot, en ms depuis le début du sous-titre.
#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
pub struct TempsMot {
    pub debut: f64,
    pub fin: f64,
}

/// Le mot prononcé : sa couleur et son agrandissement.
#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct Actif {
    pub couleur: String,
    pub echelle: f64,
}

/// Ce qu'un texte de la page dit de son sous-titre (`sousTitre` dans le document).
#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct SousTitre {
    #[serde(default)]
    pub mots: Vec<TempsMot>,
    pub actif: Option<Actif>,
    pub progressif: Option<bool>,
}

/// Les temps des `n` mots du texte : ceux de la transcription quand le compte y est ; sinon, la
/// durée des mots partagée également entre eux.
pub fn temps_des_mots(mots: &[TempsMot], n: usize) -> Vec<TempsMot> {
    if n == 0 || mots.is_empty() {
        return Vec::new();
    }
    if mots.len() == n {
        return mots.to_vec();
    }
    let debut = mots[0].debut;
    let fin = mots[mots.len() - 1].fin.max(debut);
    let pas = (fin - debut) / n as f64;
    (0..n).map(|i| TempsMot { debut: debut + pas * i as f64, fin: debut + pas * (i + 1) as f64 }).collect()
}

/// Le rang du mot prononcé à `tr` ms du début du sous-titre : le dernier mot commencé ; -1 avant
/// le premier.
pub fn mot_actif(mots: &[TempsMot], n: usize, tr: f64) -> i64 {
    temps_des_mots(mots, n).iter().enumerate().filter(|(_, t)| t.debut <= tr).map(|(i, _)| i as i64).next_back().unwrap_or(-1)
}

/// Ce qu'une lettre d'un sous-titre devient à l'instant où le mot `actif` est prononcé : `None`
/// si elle ne se dessine pas, sinon l'agrandissement à appliquer autour du milieu de son mot.
/// Chaque lettre existe en deux calques : l'ordinaire et la variante « actif » (couleur du mot
/// prononcé) ; une seule des deux se dessine.
pub fn lettre_de_sous_titre(st: &SousTitre, mot: f64, variante_active: bool, actif: i64) -> Option<f64> {
    let mot = mot as i64;
    if st.progressif == Some(true) && mot > actif {
        return None;
    }
    let en_valeur = st.actif.is_some() && mot == actif;
    match (variante_active, en_valeur) {
        (true, true) => Some(st.actif.as_ref().map_or(1.0, |a| a.echelle)),
        (false, false) => Some(1.0),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    const ATTENDUS: &str = include_str!("../../src/modele/sousTitres.attendus.json");

    #[test]
    fn les_formules_retrouvent_le_tableau_commun() {
        let tableau: Value = serde_json::from_str(ATTENDUS).unwrap();
        let cas = tableau["cas"].as_array().unwrap();
        assert!(cas.len() >= 200, "{} cas seulement", cas.len());
        let mut ecarts = Vec::new();
        for (i, c) in cas.iter().enumerate() {
            let mots: Vec<TempsMot> = serde_json::from_value(c["mots"].clone()).unwrap();
            let n = c["n"].as_u64().unwrap() as usize;
            let tr = c["tr"].as_f64().unwrap();
            let temps: Vec<Vec<f64>> = serde_json::from_value(c["temps"].clone()).unwrap();
            let calcules = temps_des_mots(&mots, n);
            if calcules.len() != temps.len() || calcules.iter().zip(&temps).any(|(a, b)| (a.debut - b[0]).abs() > 1e-6 || (a.fin - b[1]).abs() > 1e-6) {
                ecarts.push(format!("cas {i} : temps {calcules:?} au lieu de {temps:?}"));
            }
            let actif = mot_actif(&mots, n, tr);
            if actif != c["actif"].as_i64().unwrap() {
                ecarts.push(format!("cas {i} : mot {actif} au lieu de {}", c["actif"]));
            }
        }
        assert!(ecarts.is_empty(), "{}", ecarts.join("\n"));
    }

    #[test]
    fn une_seule_variante_de_chaque_lettre_se_dessine() {
        let st = SousTitre { mots: vec![], actif: Some(Actif { couleur: "#ffd60a".into(), echelle: 1.12 }), progressif: None };
        // Le mot 1 est prononcé : sa variante « actif » se dessine, agrandie ; les autres mots, en
        // ordinaire.
        assert_eq!(lettre_de_sous_titre(&st, 1.0, true, 1), Some(1.12));
        assert_eq!(lettre_de_sous_titre(&st, 1.0, false, 1), None);
        assert_eq!(lettre_de_sous_titre(&st, 0.0, false, 1), Some(1.0));
        assert_eq!(lettre_de_sous_titre(&st, 0.0, true, 1), None);
        // Progressif : un mot pas encore dit ne se voit pas.
        let p = SousTitre { progressif: Some(true), ..st.clone() };
        assert_eq!(lettre_de_sous_titre(&p, 2.0, false, 1), None);
        assert_eq!(lettre_de_sous_titre(&p, 0.0, false, -1), None);
        // Sans mise en valeur : toujours l'ordinaire.
        let simple = SousTitre { actif: None, ..st };
        assert_eq!(lettre_de_sous_titre(&simple, 1.0, false, 1), Some(1.0));
    }
}
