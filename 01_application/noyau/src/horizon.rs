//! L'horizon d'une photo (étape 5, lot 5) : le bouton « Auto » du redressement. Le noyau cherche
//! la ligne droite la plus marquée de l'image, presque horizontale (un horizon, une table, un
//! toit) ou presque verticale (un mur, un poteau), et rend l'angle qui la remet droite.
//!
//! Méthode : l'aperçu réduit à 640 px de grand côté, en gris ; les bords les plus nets (filtre de
//! Sobel, le dixième le plus fort) ; puis une transformée de Hough limitée aux droites à moins
//! de 20° de l'horizontale ou de la verticale, par pas de 0,1°, chaque bord votant pour les
//! droites à moins de 8° de sa propre direction, au poids de sa netteté ; l'angle de la droite
//! la plus forte est affiné par la moyenne de ses voisines. Mesuré sur des horizons et des murs
//! dessinés penchés de -2,5 à 7,25° : à 0,1° près. Une droite qui ne court pas sur le cinquième au
//! moins de l'image ne compte pas : sans ligne assez longue, pas de réponse plutôt qu'un angle
//! au hasard. Une horizontale l'emporte sur une verticale de même force (les verticales d'une
//! photo prise d'en bas convergent).

use image::RgbaImage;
use image::imageops::{FilterType, resize};

/// Le grand côté de l'image analysée.
const COTE: u32 = 640;
/// Les droites cherchées : à moins de tant de degrés de l'horizontale ou de la verticale.
const ECART_MAX: f32 = 20.0;
/// Le pas des angles essayés, en degrés.
const PAS: f32 = 0.1;
/// Chaque bord vote pour les angles à moins de tant de degrés de sa propre direction (la
/// direction d'un seul bord est imprécise : une arête en escalier paraît droite par endroits).
const TOLERANCE: f32 = 8.0;
/// Une droite doit courir sur au moins cette part du côté qu'elle traverse.
const LONGUEUR_MIN: f32 = 0.2;

/// Ce que l'analyse a trouvé : l'angle qui redresse l'image (degrés, positif : dans le sens des
/// aiguilles d'une montre), et la droite qui l'a donné.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Horizon {
    pub angle: f32,
    /// Vrai : une ligne presque horizontale ; faux : presque verticale.
    pub horizontale: bool,
    /// La force de la droite : ses bords, comptés en bords de force moyenne, rapportés au côté
    /// qu'elle traverse (une ligne nette sur toute la largeur dépasse 1).
    pub force: f32,
}

/// L'angle qui redresse `image`, ou `None` si aucune droite n'est assez nette.
pub fn redressement(image: &RgbaImage) -> Option<Horizon> {
    let (l0, h0) = image.dimensions();
    if l0 < 16 || h0 < 16 {
        return None;
    }
    let k = COTE as f32 / l0.max(h0) as f32;
    let petite = if k < 1.0 { resize(image, ((l0 as f32 * k).round() as u32).max(16), ((h0 as f32 * k).round() as u32).max(16), FilterType::Triangle) } else { image.clone() };
    let (l, h) = (petite.width() as usize, petite.height() as usize);
    let gris: Vec<f32> = petite.pixels().map(|p| (0.2126 * p[0] as f32 + 0.7152 * p[1] as f32 + 0.0722 * p[2] as f32) / 255.0).collect();
    // Sobel.
    let mut bords: Vec<(f32, f32, f32, f32)> = Vec::new();
    let g = |x: usize, y: usize| gris[y * l + x];
    let mut forces = Vec::with_capacity(l * h);
    let mut tous = Vec::with_capacity(l * h);
    for y in 1..h - 1 {
        for x in 1..l - 1 {
            let gx = (g(x + 1, y - 1) + 2.0 * g(x + 1, y) + g(x + 1, y + 1)) - (g(x - 1, y - 1) + 2.0 * g(x - 1, y) + g(x - 1, y + 1));
            let gy = (g(x - 1, y + 1) + 2.0 * g(x, y + 1) + g(x + 1, y + 1)) - (g(x - 1, y - 1) + 2.0 * g(x, y - 1) + g(x + 1, y - 1));
            let m = (gx * gx + gy * gy).sqrt();
            forces.push(m);
            tous.push((x as f32, y as f32, gx, gy, m));
        }
    }
    let mut tries = forces.clone();
    tries.sort_by(|a, b| a.total_cmp(b));
    let seuil = tries[(tries.len() as f32 * 0.9) as usize].max(0.15);
    for (x, y, gx, gy, m) in tous {
        if m >= seuil {
            bords.push((x, y, gy.atan2(gx).to_degrees() + 90.0, m));
        }
    }
    if bords.len() < 20 {
        return None;
    }
    let force_moyenne = bords.iter().map(|b| b.3).sum::<f32>() / bords.len() as f32;
    let n_angles = (2.0 * ECART_MAX / PAS).round() as usize + 1;
    let n_rho = l + h + 2;
    let mut meilleure: Option<(f32, f32, bool, f32)> = None;
    for horizontale in [true, false] {
        let mut acc = vec![0.0f32; n_angles * n_rho * 2];
        for &(x, y, alpha, m) in &bords {
            // La direction de la droite, de -90 à 90 degrés ; son écart à l'axe cherché.
            let a = ((alpha + 90.0).rem_euclid(180.0)) - 90.0;
            let ecart = if horizontale { a } else if a > 0.0 { a - 90.0 } else { a + 90.0 };
            if ecart.abs() > ECART_MAX + TOLERANCE {
                continue;
            }
            let i0 = (((ecart - TOLERANCE + ECART_MAX) / PAS).floor().max(0.0)) as usize;
            let i1 = ((((ecart + TOLERANCE + ECART_MAX) / PAS).ceil()) as usize).min(n_angles - 1);
            for i in i0..=i1 {
                let phi = (i as f32 * PAS - ECART_MAX).to_radians();
                // La distance de la droite à l'origine, le long de sa normale.
                let rho = if horizontale { -x * phi.sin() + y * phi.cos() } else { x * phi.cos() + y * phi.sin() };
                let j = (rho.round() as isize + n_rho as isize) as usize;
                if j < 2 * n_rho {
                    acc[i * 2 * n_rho + j] += m;
                }
            }
        }
        let (mut imax, mut vmax) = (0usize, 0.0f32);
        for (i, v) in acc.iter().enumerate() {
            if *v > vmax {
                vmax = *v;
                imax = i;
            }
        }
        let (ia, jr) = (imax / (2 * n_rho), imax % (2 * n_rho));
        // L'angle affiné : la moyenne des voisins de la cellule la plus forte.
        let (mut somme, mut poids) = (0.0f32, 0.0f32);
        for i in ia.saturating_sub(3)..=(ia + 3).min(n_angles - 1) {
            for j in jr.saturating_sub(1)..=(jr + 1).min(2 * n_rho - 1) {
                let v = acc[i * 2 * n_rho + j];
                somme += v * (i as f32 * PAS - ECART_MAX);
                poids += v;
            }
        }
        let ecart = if poids > 0.0 { somme / poids } else { ia as f32 * PAS - ECART_MAX };
        // La force de la droite : ses bords, comptés en bords de force moyenne, rapportés au
        // côté qu'elle traverse.
        let force = vmax / force_moyenne / if horizontale { l as f32 } else { h as f32 };
        let score = if horizontale { force } else { force * 0.8 };
        if force >= LONGUEUR_MIN && meilleure.is_none_or(|(s, _, _, _)| score > s) {
            meilleure = Some((score, ecart, horizontale, force));
        }
    }
    let (_, ecart, horizontale, force) = meilleure?;
    let angle = (-ecart / 0.05).round() * 0.05;
    Some(Horizon { angle: if angle.abs() < 0.05 { 0.0 } else { angle }, horizontale, force })
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::Rgba;

    /// Un paysage : un ciel clair, une mer sombre sous un horizon tourné de `angle` degrés dans
    /// le sens des aiguilles d'une montre, des nuages, du bruit.
    fn paysage(angle: f32, l: u32, h: u32) -> RgbaImage {
        let t = angle.to_radians();
        let (cx, cy) = (l as f32 / 2.0, h as f32 * 0.55);
        RgbaImage::from_fn(l, h, |x, y| {
            let (dx, dy) = (x as f32 - cx, y as f32 - cy);
            // Sous l'horizon : la normale de la droite tournée.
            let sous = -dx * t.sin() + dy * t.cos() > 0.0;
            let bruit = (crate::labo::hachage(x, y) & 0x1f) as f32 - 16.0;
            let nuage = ((x as f32 / 37.0).sin() * (y as f32 / 23.0).cos() * 18.0).max(0.0);
            let base = if sous { 70.0 + dy.abs() * 0.05 } else { 185.0 - (y as f32 / h as f32) * 40.0 + nuage };
            let v = (base + bruit).clamp(0.0, 255.0) as u8;
            Rgba([v / 2, v, (v as u16 * 5 / 4).min(255) as u8, 255])
        })
    }

    #[test]
    fn un_horizon_penche_se_redresse() {
        for angle in [3.5f32, -2.0, 7.25, 0.0] {
            let h = redressement(&paysage(angle, 1200, 800)).expect("un horizon");
            assert!(h.horizontale, "{angle} : {h:?}");
            assert!((h.angle + angle).abs() <= 0.15, "penché de {angle}° : redressé de {}°", h.angle);
        }
    }

    #[test]
    fn un_mur_penche_se_redresse() {
        // Un mur sombre à gauche, son arête presque verticale, tournée de -2,5°.
        let t = (-2.5f32).to_radians();
        let img = RgbaImage::from_fn(900, 1200, |x, y| {
            let (dx, dy) = (x as f32 - 450.0, y as f32 - 600.0);
            // La direction d'une verticale tournée : (-sin t, cos t) ; sa normale : (cos t, sin t).
            let gauche = dx * t.cos() + dy * t.sin() < 0.0;
            let bruit = (crate::labo::hachage(x, y) & 0x0f) as f32;
            let v = if gauche { 60.0 + bruit } else { 200.0 + bruit } as u8;
            Rgba([v, v, v, 255])
        });
        let h = redressement(&img).expect("un mur");
        assert!(!h.horizontale && (h.angle - 2.5).abs() <= 0.15, "{h:?}");
    }

    #[test]
    fn sans_ligne_nette_pas_de_reponse() {
        let bruit = RgbaImage::from_fn(800, 600, |x, y| {
            let v = (crate::labo::hachage(x, y) & 0xff) as u8;
            Rgba([v, v, v, 255])
        });
        assert_eq!(redressement(&bruit), None);
        let uni = RgbaImage::from_pixel(800, 600, Rgba([120, 130, 140, 255]));
        assert_eq!(redressement(&uni), None);
    }
}
