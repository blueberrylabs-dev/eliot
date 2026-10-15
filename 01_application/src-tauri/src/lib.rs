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
        .manage(commandes::PolicesPoste::default())
        .manage(commandes::Pixabay::default())
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
            commandes::importer_videos,
            commandes::ressources_lister,
            commandes::ressources_copier,
            commandes::lire_ressource,
            commandes::image_video,
            commandes::polices_poste,
            commandes::police_poste_lire,
            commandes::police_vers_design,
            commandes::polices_design,
            commandes::police_design_lire,
            commandes::pixabay_etat,
            commandes::pixabay_chercher,
            commandes::pixabay_apercu,
            commandes::pixabay_importer,
            commandes::pixabay_chercher_videos,
            commandes::pixabay_apercu_video,
            commandes::pixabay_importer_video,
            commandes::marque_lire,
            commandes::marque_enregistrer,
            commandes::exporter_rendu,
            commandes::dossier_export,
            commandes::autotest_demande,
            commandes::autotest_rapport,
            ia::ia_infos,
            ia::ia_activer,
            ia::ia_repondre,
            ia::ia_pret,
        ])
        .run(tauri::generate_context!())
        .expect("échec du lancement d'Eliot");
}
