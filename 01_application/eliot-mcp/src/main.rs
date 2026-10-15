//! `eliot-mcp` : le pont entre une IA (client MCP, comme l'application Claude ou Claude Code) et
//! Eliot ouvert sur le même poste (BRIEF § 6, « Brancher une IA »).
//!
//! Le client lance ce programme et lui parle par l'entrée et la sortie standard. Pour chaque
//! appel d'outil, le pont se connecte au fichier de communication d'Eliot (socket Unix, réservé
//! à l'utilisateur), transmet l'appel et rend la réponse. Il ne lance jamais Eliot (règle 9) :
//! fenêtre fermée ou pont désactivé, l'outil répond qu'Eliot n'est pas joignable.
//!
//! La liste des outils vient de `src/ia/outils.json`, le même fichier que l'interface : les
//! deux côtés ne peuvent pas diverger.

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use rmcp::model::{
    CallToolRequestParams, CallToolResponse, CallToolResult, ContentBlock, Implementation, ListToolsResult,
    PaginatedRequestParams, ServerCapabilities, ServerConfig, Tool,
};
use rmcp::service::RequestContext;
use rmcp::{ErrorData as McpError, RoleServer, ServerHandler, ServiceExt};
use serde_json::{Map, Value, json};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::UnixStream;

const OUTILS: &str = include_str!("../../src/ia/outils.json");
const DELAI: Duration = Duration::from_secs(150);
/// Un export en MP4 ou en GIF peut durer plusieurs minutes (Eliot attend 30 minutes au plus).
const DELAI_FILM: Duration = Duration::from_secs(1830);

const CONSIGNES: &str = "Eliot est l'éditeur graphique d'Alexandre (visuels et vidéos pour YouTube, TikTok, Instagram), ouvert sur son poste. \
Tu travailles dans le design ouvert, sous ses yeux : chaque outil qui modifie passe par l'historique d'Eliot, Ctrl+Z le défait. \
Coordonnées en pixels de la page, origine en haut à gauche ; un élément tourne autour de son coin haut gauche. \
Commence par `etat` ; après une série de modifications, regarde le résultat avec `capture` avant de dire que c'est fini. \
Couleurs en #rrggbb ; polices : celles que donne `etat`. Tu ne peux ni supprimer un design ni écrire hors des dossiers d'Eliot.";

/// Les endroits où Eliot peut avoir ouvert son fichier de communication, dans l'ordre d'essai.
///
/// Eliot le pose dans `$XDG_RUNTIME_DIR` (en pratique `/run/user/<uid>`), sinon dans
/// `~/.cache` (`src-tauri/src/ia.rs`). Mais l'application Claude lance ses serveurs MCP avec
/// un environnement réduit, sans `XDG_RUNTIME_DIR` : le pont essaie donc aussi
/// `/run/user/<uid>` directement, avant `~/.cache`.
fn chemins_socket() -> Vec<PathBuf> {
    let mut bases: Vec<PathBuf> = Vec::new();
    if let Some(d) = std::env::var_os("XDG_RUNTIME_DIR").map(PathBuf::from).filter(|d| d.is_dir()) {
        bases.push(d);
    }
    if let Some(uid) = uid() {
        let d = PathBuf::from(format!("/run/user/{uid}"));
        if d.is_dir() {
            bases.push(d);
        }
    }
    bases.push(std::env::var_os("HOME").map(PathBuf::from).unwrap_or_else(std::env::temp_dir).join(".cache"));
    let mut chemins: Vec<PathBuf> = Vec::new();
    for base in bases {
        let chemin = base.join("eliot").join("eliot.sock");
        if !chemins.contains(&chemin) {
            chemins.push(chemin);
        }
    }
    chemins
}

/// Numéro de l'utilisateur, lu sur `/proc/self` (il appartient au processus lui-même).
fn uid() -> Option<u32> {
    use std::os::unix::fs::MetadataExt;
    std::fs::metadata("/proc/self").ok().map(|m| m.uid())
}

fn outils() -> Vec<Tool> {
    let liste: Vec<Value> = serde_json::from_str(OUTILS).expect("outils.json est un tableau JSON valide");
    liste
        .into_iter()
        .map(|o| {
            let nom = o["name"].as_str().expect("outil sans nom").to_string();
            let description = o["description"].as_str().unwrap_or_default().to_string();
            let schema: Map<String, Value> = o["inputSchema"].as_object().cloned().unwrap_or_default();
            Tool::new(nom, description, Arc::new(schema))
        })
        .collect()
}

/// Envoie un appel à Eliot et attend sa réponse.
async fn appeler(outil: &str, arguments: Value) -> Result<Value, String> {
    appeler_sur(&chemins_socket(), outil, arguments).await
}

async fn connecter(chemins: &[PathBuf]) -> Option<UnixStream> {
    for chemin in chemins {
        if let Ok(flux) = UnixStream::connect(chemin).await {
            return Some(flux);
        }
    }
    None
}

async fn appeler_sur(chemins: &[PathBuf], outil: &str, arguments: Value) -> Result<Value, String> {
    let flux = connecter(chemins).await.ok_or_else(|| {
        let essais: Vec<String> = chemins.iter().map(|c| c.display().to_string()).collect();
        format!(
            "Eliot n'est pas joignable : il n'est pas ouvert, ou le pont IA est désactivé (Fichier, Réglages). \
Demande à Alexandre de l'ouvrir ; ce pont ne lance jamais Eliot. Fichiers de communication essayés : {}.",
            essais.join(", ")
        )
    })?;
    let (lecture, mut ecriture) = flux.into_split();
    let film = outil == "exporter" && matches!(arguments.get("format").and_then(Value::as_str), Some("mp4" | "gif"));
    let delai = if film { DELAI_FILM } else { DELAI };
    let mut ligne = json!({ "id": 1, "outil": outil, "arguments": arguments }).to_string();
    ligne.push('\n');
    ecriture.write_all(ligne.as_bytes()).await.map_err(|e| format!("envoi impossible : {e}"))?;
    let mut reponse = String::new();
    tokio::time::timeout(delai, BufReader::new(lecture).read_line(&mut reponse))
        .await
        .map_err(|_| "Eliot n'a pas répondu à temps".to_string())?
        .map_err(|e| format!("lecture impossible : {e}"))?;
    let valeur: Value = serde_json::from_str(&reponse).map_err(|e| format!("réponse illisible : {e}"))?;
    if valeur["ok"].as_bool() == Some(true) {
        Ok(valeur["resultat"].clone())
    } else {
        Err(valeur["erreur"].as_str().unwrap_or("erreur inconnue").to_string())
    }
}

struct PontEliot {
    outils: Vec<Tool>,
}

impl ServerHandler for PontEliot {
    #[allow(deprecated)]
    fn get_info(&self) -> ServerConfig {
        ServerConfig::new(ServerCapabilities::builder().enable_tools().build())
            .with_server_info(Implementation::new("eliot", env!("CARGO_PKG_VERSION")))
            .with_instructions(CONSIGNES)
    }

    async fn list_tools(&self, _requete: Option<PaginatedRequestParams>, _contexte: RequestContext<RoleServer>) -> Result<ListToolsResult, McpError> {
        Ok(ListToolsResult::with_all_items(self.outils.clone()))
    }

    async fn call_tool(&self, requete: CallToolRequestParams, _contexte: RequestContext<RoleServer>) -> Result<CallToolResponse, McpError> {
        let nom = requete.name.to_string();
        if !self.outils.iter().any(|o| o.name == nom) {
            return Ok(CallToolResult::error(vec![ContentBlock::text(format!("outil inconnu : {nom}"))]).into());
        }
        let arguments = requete.arguments.map(Value::Object).unwrap_or_else(|| json!({}));
        let resultat = match appeler(&nom, arguments).await {
            Err(message) => CallToolResult::error(vec![ContentBlock::text(message)]),
            Ok(valeur) => {
                let mut contenu = vec![ContentBlock::text(serde_json::to_string_pretty(&valeur["donnees"]).unwrap_or_default())];
                // Le champ s'appelle `imagePng` depuis l'étape 2 ; il porte aussi du JPEG (planche
                // de photos), reconnu à ses premiers octets.
                if let Some(image) = valeur["imagePng"].as_str() {
                    contenu.push(ContentBlock::image(image.to_string(), type_image(image)));
                }
                CallToolResult::success(contenu)
            }
        };
        Ok(resultat.into())
    }
}

/// Type d'une image en base64 : les octets FF D8 FF d'un JPEG s'écrivent « /9j/ ».
fn type_image(base64: &str) -> &'static str {
    if base64.starts_with("/9j/") { "image/jpeg" } else { "image/png" }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let service = PontEliot { outils: outils() }.serve(rmcp::transport::stdio()).await?;
    service.waiting().await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn une_image_jpeg_est_annoncee_comme_telle() {
        assert_eq!(type_image("/9j/4AAQSkZJRg"), "image/jpeg");
        assert_eq!(type_image("iVBORw0KGgo"), "image/png");
    }

    #[test]
    fn la_liste_des_outils_se_lit() {
        let liste = outils();
        assert!(liste.len() >= 20);
        assert!(liste.iter().any(|o| o.name == "capture"));
        for o in &liste {
            assert_eq!(o.input_schema.get("type").and_then(Value::as_str), Some("object"), "{}", o.name);
        }
    }

    #[tokio::test]
    async fn eliot_ferme_donne_un_message_clair() {
        // Un dossier vide pour le fichier de communication : personne n'écoute.
        let dossier = std::env::temp_dir().join(format!("eliot-mcp-test-{}", std::process::id()));
        std::fs::create_dir_all(&dossier).unwrap();
        let chemin = dossier.join("eliot.sock");
        let erreur = appeler_sur(&[chemin.clone()], "etat", json!({})).await.unwrap_err();
        assert!(erreur.contains("pas joignable"), "{erreur}");
        assert!(erreur.contains(&chemin.display().to_string()), "{erreur}");
        std::fs::remove_dir_all(&dossier).unwrap();
    }

    #[tokio::test]
    async fn le_second_chemin_sert_si_le_premier_est_vide() {
        // Cas de l'application Claude : le premier endroit n'a personne, Eliot écoute au second.
        let dossier = std::env::temp_dir().join(format!("eliot-mcp-test2-{}", std::process::id()));
        std::fs::create_dir_all(&dossier).unwrap();
        let vide = dossier.join("absent.sock");
        let bon = dossier.join("eliot.sock");
        let ecoute = tokio::net::UnixListener::bind(&bon).unwrap();
        tokio::spawn(async move {
            let (flux, _) = ecoute.accept().await.unwrap();
            let (lecture, mut ecriture) = flux.into_split();
            let mut ligne = String::new();
            BufReader::new(lecture).read_line(&mut ligne).await.unwrap();
            let appel: Value = serde_json::from_str(&ligne).unwrap();
            let reponse = json!({ "id": appel["id"], "ok": true, "resultat": { "donnees": { "outil": appel["outil"] } } });
            ecriture.write_all(format!("{reponse}\n").as_bytes()).await.unwrap();
        });
        let valeur = appeler_sur(&[vide, bon], "etat", json!({})).await.unwrap();
        assert_eq!(valeur["donnees"]["outil"], "etat");
        std::fs::remove_dir_all(&dossier).unwrap();
    }

    #[test]
    fn la_session_est_essayee_meme_sans_xdg_runtime_dir() {
        let chemins = chemins_socket();
        assert!(chemins.last().unwrap().ends_with(".cache/eliot/eliot.sock"));
        let session = PathBuf::from(format!("/run/user/{}", uid().unwrap()));
        if session.is_dir() {
            assert!(chemins.contains(&session.join("eliot").join("eliot.sock")), "{chemins:?}");
        }
    }
}
