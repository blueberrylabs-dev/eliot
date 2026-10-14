// Empêche l'ouverture d'une console en plus sous Windows en version finale. Ne pas retirer.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    eliot_lib::lancer()
}
