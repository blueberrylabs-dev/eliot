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
        .manage(commandes::Freesound::default())
        .manage(commandes::Micro::default())
        .manage(commandes::Transcriptions::default())
        .manage(commandes::Detourages::default())
        .manage(commandes::ExportVideo::default())
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
            commandes::importer_modeles3d,
            commandes::importer_modele3d_octets,
            commandes::miniature_modele3d,
            commandes::importer_videos,
            commandes::importer_sons,
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
            commandes::freesound_etat,
            commandes::freesound_chercher,
            commandes::freesound_extrait,
            commandes::freesound_importer,
            commandes::micro_lister,
            commandes::micro_ouvrir,
            commandes::micro_commencer,
            commandes::micro_marquer,
            commandes::micro_abandonner,
            commandes::micro_fermer,
            commandes::micro_arreter,
            commandes::voix_nettoyer,
            commandes::voix_lire,
            commandes::voix_purger,
            commandes::piper_etat,
            commandes::piper_ecouter,
            commandes::piper_ajouter,
            commandes::parole_analyser,
            commandes::whisper_etat,
            commandes::parole_transcrire,
            commandes::parole_annuler,
            commandes::marque_lire,
            commandes::marque_enregistrer,
            commandes::exporter_rendu,
            commandes::dossier_export,
            commandes::dossier_export_video,
            commandes::exporter_video,
            commandes::annuler_export_video,
            commandes::exporter_document,
            commandes::labo_base,
            commandes::labo_base_pixels,
            commandes::labo_horizon,
            commandes::detourage_etat,
            commandes::detourage_lancer,
            commandes::detourage_annuler,
            commandes::detourage_masque,
            commandes::prereglages_lire,
            commandes::prereglages_enregistrer,
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
