// The Rust side only does I/O. HTTP to Tally goes through tauri-plugin-http, whose
// scope (capabilities/default.json) allows localhost only. Tally sends no CORS
// headers, so a plain webview fetch would be blocked.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .run(tauri::generate_context!())
        .expect("error while running tally-helper");
}
