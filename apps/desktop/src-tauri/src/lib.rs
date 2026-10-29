// The Rust side only does I/O. HTTP to Tally goes through tauri-plugin-http, whose
// scope (capabilities/default.json) allows localhost only. Tally sends no CORS
// headers, so a plain webview fetch would be blocked. The updater fetches signed releases
// from GitHub (tauri.conf.json) and the process plugin restarts the app after an update.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("error while running tally-helper");
}
