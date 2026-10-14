//! Eliot, côté Rust : l'enveloppe Tauri. Elle ne fait qu'exposer le noyau (`noyau/`) à
//! l'interface ; tout le travail réel est dans le noyau, qui ne dépend pas de Tauri.

mod commandes;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn lancer() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commandes::importer_images,
            commandes::importer_image_octets,
            commandes::lire_ressource,
            commandes::exporter_rendu,
            commandes::dossier_export,
            commandes::autotest_demande,
            commandes::autotest_rapport,
        ])
        .run(tauri::generate_context!())
        .expect("échec du lancement d'Eliot");
}
