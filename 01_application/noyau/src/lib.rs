//! Noyau d'Eliot.
//!
//! Tout le travail lourd et tout accès au disque passent par ici : l'interface ne lit ni
//! n'écrit jamais de fichier elle-même, et ne manipule jamais une image en pleine résolution
//! (BRIEF, règles 4 à 8). Ce paquet ne dépend pas de Tauri : il se teste seul et resterait
//! tel quel si l'enveloppe changeait.

pub mod animation;
pub mod detourage;
pub mod environnements3d;
pub mod export;
pub mod fichiers;
pub mod freesound;
pub mod horizon;
pub mod images;
pub mod labo;
pub mod marque;
pub mod micro;
pub mod modeles3d;
pub mod montage;
pub mod parole;
pub mod perspective;
pub mod pexels;
pub mod piper;
pub mod pixabay;
pub mod polices;
pub mod polyhaven;
pub mod projet;
pub mod reseau;
pub mod rendu_page;
pub mod sketchfab;
pub mod son;
pub mod sons;
pub mod sous_titres;
pub mod videos;
pub mod voix;
