use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
struct TaskFile {
    schema_version: u32,
    revision: u64,
    tasks: serde_json::Value,
    #[serde(default)]
    groups: Option<serde_json::Value>,
}

fn task_path(folder: &str) -> Result<PathBuf, String> {
    let root = Path::new(folder);
    if !root.is_absolute() {
        return Err("Task folder must be an absolute path".into());
    }
    Ok(root.join("tasks.json"))
}

#[tauri::command]
fn read_tasks(folder: String) -> Result<serde_json::Value, String> {
    let path = task_path(&folder)?;
    if !path.exists() {
        return Ok(serde_json::json!({ "schema_version": 1, "revision": 0, "tasks": [] }));
    }
    let content = fs::read_to_string(&path).map_err(|error| format!("Could not read tasks: {error}"))?;
    let parsed: TaskFile = serde_json::from_str(&content).map_err(|error| format!("Task file is invalid; original file was left untouched: {error}"))?;
    if parsed.schema_version != 1 {
        return Err(format!("Unsupported task file version: {}", parsed.schema_version));
    }
    serde_json::to_value(parsed).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_tasks(folder: String, tasks: serde_json::Value, groups: Option<serde_json::Value>, revision: u64) -> Result<u64, String> {
    let path = task_path(&folder)?;
    fs::create_dir_all(path.parent().ok_or("Invalid task folder")?).map_err(|error| error.to_string())?;
    let current_revision = if path.exists() {
        let content = fs::read_to_string(&path).map_err(|error| error.to_string())?;
        let current: TaskFile = serde_json::from_str(&content).map_err(|error| format!("Task file is invalid; original file was left untouched: {error}"))?;
        current.revision
    } else { 0 };
    if current_revision != revision {
        return Err("Task data changed outside the app. Reload it before saving to avoid overwriting changes.".into());
    }
    let next_revision = revision + 1;
    let payload = serde_json::to_vec_pretty(&TaskFile { schema_version: 1, revision: next_revision, tasks, groups })
        .map_err(|error| error.to_string())?;
    let temp = path.with_extension(format!("{}.tmp", std::process::id()));
    fs::write(&temp, payload).map_err(|error| format!("Could not write task file: {error}"))?;
    if path.exists() {
        let backup_dir = path.parent().unwrap().join("backups");
        fs::create_dir_all(&backup_dir).map_err(|error| error.to_string())?;
        let backup = backup_dir.join(format!("tasks-{}.json", current_revision));
        fs::copy(&path, backup).map_err(|error| format!("Could not back up task file: {error}"))?;
        #[cfg(windows)]
        fs::remove_file(&path).map_err(|error| format!("Could not replace task file: {error}"))?;
        fs::rename(&temp, &path).map_err(|error| format!("Could not replace task file: {error}"))?;
    } else {
        fs::rename(&temp, &path).map_err(|error| format!("Could not create task file: {error}"))?;
    }
    Ok(next_revision)
}

#[tauri::command]
async fn select_task_folder(app: tauri::AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    app.dialog().file().blocking_pick_folder().map(|path| path.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![read_tasks, write_tasks, select_task_folder])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                use tauri::TitleBarStyle;
                let _ = window.set_title_bar_style(TitleBarStyle::Overlay);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Floating Todo");
}
