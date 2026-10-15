//! Noyau d'Eliot.
//!
//! Tout le travail lourd et tout accès au disque passent par ici : l'interface ne lit ni
//! n'écrit jamais de fichier elle-même, et ne manipule jamais une image en pleine résolution
//! (BRIEF, règles 4 à 8). Ce paquet ne dépend pas de Tauri : il se teste seul et resterait
//! tel quel si l'enveloppe changeait.

pub mod animation;
pub mod export;
pub mod fichiers;
pub mod images;
pub mod marque;
pub mod montage;
pub mod pixabay;
pub mod polices;
pub mod projet;
pub mod videos;
