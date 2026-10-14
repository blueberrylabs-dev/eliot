//! Banc d'essai de Eliot, côté Rust.
//!
//! Deux commandes seulement : décrire la machine (pour étiqueter les résultats) et mesurer ce
//! que coûte en Rust natif le traitement d'une photo 24 Mpx (décodage, réduction à 2560 px,
//! encodage JPEG), à comparer avec le même traitement fait par le moteur web.

use std::fs;
use std::path::PathBuf;
use std::time::Instant;

use fast_image_resize::{FilterType, IntoImageView, ResizeAlg, ResizeOptions, Resizer};
use image::codecs::jpeg::JpegEncoder;
use serde::Serialize;

/// Fichier de test, rangé par `outils/generer_donnees.py`.
fn chemin_photo() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("public")
        .join("donnees")
        .join("photo_24mpx.jpg")
}

#[derive(Serialize)]
pub struct InfosSysteme {
    processeur: String,
    coeurs: usize,
    memoire_go: f64,
    cartes_graphiques: Vec<String>,
    session: String,
    variables: Vec<(String, String)>,
    lancement_automatique: bool,
}

/// Première ligne de /proc/cpuinfo qui commence par `cle`.
fn lire_cpuinfo(cle: &str) -> Option<String> {
    let texte = fs::read_to_string("/proc/cpuinfo").ok()?;
    texte
        .lines()
        .find(|ligne| ligne.starts_with(cle))
        .and_then(|ligne| ligne.split(':').nth(1))
        .map(|valeur| valeur.trim().to_string())
}

fn memoire_totale_go() -> f64 {
    let texte = fs::read_to_string("/proc/meminfo").unwrap_or_default();
    let ko: f64 = texte
        .lines()
        .find(|ligne| ligne.starts_with("MemTotal:"))
        .and_then(|ligne| ligne.split_whitespace().nth(1))
        .and_then(|valeur| valeur.parse().ok())
        .unwrap_or(0.0);
    (ko / 1024.0 / 1024.0 * 10.0).round() / 10.0
}

/// Cartes vues par le noyau Linux : fabricant (identifiant PCI) et pilote chargé.
fn cartes_graphiques() -> Vec<String> {
    let mut cartes = Vec::new();
    let Ok(entrees) = fs::read_dir("/sys/class/drm") else {
        return cartes;
    };
    for entree in entrees.flatten() {
        let nom = entree.file_name().to_string_lossy().into_owned();
        // On ne garde que card0, card1… (pas card0-HDMI-A-1 ni renderD128).
        if !nom.starts_with("card") || nom.contains('-') {
            continue;
        }
        let peripherique = entree.path().join("device");
        let fabricant = fs::read_to_string(peripherique.join("vendor")).unwrap_or_default();
        let fabricant = match fabricant.trim() {
            "0x10de" => "NVIDIA",
            "0x1002" => "AMD",
            "0x8086" => "Intel",
            "" => "inconnu",
            autre => autre,
        };
        let pilote = fs::read_link(peripherique.join("driver"))
            .ok()
            .and_then(|lien| lien.file_name().map(|n| n.to_string_lossy().into_owned()))
            .unwrap_or_else(|| "?".to_string());
        cartes.push(format!("{nom} : {fabricant}, pilote {pilote}"));
    }
    cartes.sort();
    cartes
}

#[tauri::command]
fn infos_systeme() -> InfosSysteme {
    let surveillees = [
        "WEBKIT_DISABLE_DMABUF_RENDERER",
        "WEBKIT_DISABLE_COMPOSITING_MODE",
        "__NV_DISABLE_EXPLICIT_SYNC",
        "GDK_BACKEND",
    ];
    let variables = surveillees
        .iter()
        .filter_map(|nom| std::env::var(nom).ok().map(|v| (nom.to_string(), v)))
        .collect();
    InfosSysteme {
        processeur: lire_cpuinfo("model name").unwrap_or_else(|| "?".to_string()),
        coeurs: std::thread::available_parallelism().map(|n| n.get()).unwrap_or(0),
        memoire_go: memoire_totale_go(),
        cartes_graphiques: cartes_graphiques(),
        session: std::env::var("XDG_SESSION_TYPE").unwrap_or_else(|_| "?".to_string()),
        variables,
        lancement_automatique: std::env::var("BANC_AUTO").is_ok_and(|v| v == "1"),
    }
}

#[derive(Serialize, Clone, Copy, Debug)]
pub struct MesureReduction {
    lecture_ms: f64,
    decodage_ms: f64,
    reduction_ms: f64,
    encodage_ms: f64,
    total_ms: f64,
    largeur_source: u32,
    hauteur_source: u32,
    largeur_apercu: u32,
    hauteur_apercu: u32,
    octets_apercu: usize,
}

fn ms(depuis: Instant) -> f64 {
    (depuis.elapsed().as_secs_f64() * 1000.0 * 10.0).round() / 10.0
}

/// Une passe complète : lire, décoder, réduire à 2560 px sur le grand côté, encoder en JPEG.
fn une_reduction() -> Result<MesureReduction, String> {
    let debut = Instant::now();

    let t = Instant::now();
    let octets = fs::read(chemin_photo()).map_err(|e| format!("lecture de la photo : {e}"))?;
    let lecture_ms = ms(t);

    let t = Instant::now();
    let source = image::load_from_memory_with_format(&octets, image::ImageFormat::Jpeg)
        .map_err(|e| format!("décodage : {e}"))?
        .into_rgb8();
    let source = image::DynamicImage::ImageRgb8(source);
    let decodage_ms = ms(t);

    let (ls, hs) = (source.width(), source.height());
    let echelle = 2560.0 / ls.max(hs) as f64;
    let (la, ha) = (
        (ls as f64 * echelle).round() as u32,
        (hs as f64 * echelle).round() as u32,
    );

    let t = Instant::now();
    let type_pixel = source.pixel_type().ok_or("type de pixel inconnu")?;
    let mut apercu = fast_image_resize::images::Image::new(la, ha, type_pixel);
    let options =
        ResizeOptions::new().resize_alg(ResizeAlg::Convolution(FilterType::Lanczos3));
    Resizer::new()
        .resize(&source, &mut apercu, &options)
        .map_err(|e| format!("réduction : {e}"))?;
    let reduction_ms = ms(t);

    let t = Instant::now();
    let mut sortie = Vec::new();
    JpegEncoder::new_with_quality(&mut sortie, 85)
        .encode(apercu.buffer(), la, ha, image::ExtendedColorType::Rgb8)
        .map_err(|e| format!("encodage : {e}"))?;
    let encodage_ms = ms(t);

    Ok(MesureReduction {
        lecture_ms,
        decodage_ms,
        reduction_ms,
        encodage_ms,
        total_ms: ms(debut),
        largeur_source: ls,
        hauteur_source: hs,
        largeur_apercu: la,
        hauteur_apercu: ha,
        octets_apercu: sortie.len(),
    })
}

/// Trois passes, on garde celle dont le total est médian (la première chauffe les caches).
#[tauri::command]
async fn mesurer_reduction_rust() -> Result<MesureReduction, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut passes = (0..3).map(|_| une_reduction()).collect::<Result<Vec<_>, _>>()?;
        passes.sort_by(|a, b| a.total_ms.total_cmp(&b.total_ms));
        Ok(passes[1])
    })
    .await
    .map_err(|e| format!("tâche interrompue : {e}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn lancer() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![infos_systeme, mesurer_reduction_rust])
        .run(tauri::generate_context!())
        .expect("échec du lancement du banc d'essai");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn la_reduction_produit_un_apercu_de_2560_px() {
        let mesure = une_reduction().expect("la photo de test doit exister");
        eprintln!("{mesure:?}");
        assert_eq!(mesure.largeur_source, 6000);
        assert_eq!(mesure.largeur_apercu.max(mesure.hauteur_apercu), 2560);
        assert!(mesure.octets_apercu > 10_000);
    }
}
