//! Eliot, côté Rust : l'enveloppe Tauri. Elle ne fait qu'exposer le noyau (`noyau/`) à
//! l'interface ; tout le travail réel est dans le noyau, qui ne dépend pas de Tauri.

mod commandes;
mod ia;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn lancer() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(commandes::VerrouProjets::default())
        .manage(ia::PontIa::default())
        .setup(|app| {
            ia::au_demarrage(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commandes::projets_lister,
            commandes::projet_creer,
            commandes::projet_ouvrir,
            commandes::projet_enregistrer,
            commandes::projet_miniature_enregistrer,
            commandes::projet_miniature_lire,
            commandes::projet_renommer,
            commandes::projet_dupliquer,
            commandes::projet_supprimer,
            commandes::projet_exporter_archive,
            commandes::projet_importer_archive,
            commandes::dossier_designs,
            commandes::importer_images,
            commandes::importer_image_octets,
            commandes::ressources_lister,
            commandes::ressources_copier,
            commandes::lire_ressource,
            commandes::exporter_rendu,
            commandes::dossier_export,
            commandes::autotest_demande,
            commandes::autotest_rapport,
            ia::ia_infos,
            ia::ia_activer,
            ia::ia_repondre,
        ])
        .run(tauri::generate_context!())
        .expect("échec du lancement d'Eliot");
}
