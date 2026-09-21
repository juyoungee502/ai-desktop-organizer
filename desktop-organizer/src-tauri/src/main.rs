#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod models;
mod organizer;
mod scanner;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::scan_desktop,
            commands::execute_organize,
            commands::undo_last,
            commands::get_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running desktop organizer");
}
