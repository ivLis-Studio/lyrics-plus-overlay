use axum::{
    routing::post,
    Json, Router,
    http::Method,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Runtime, Manager, PhysicalPosition};
use tower_http::cors::{Any, CorsLayer};

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, MouseButton};
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::POINT;

// Track info from Spotify
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackInfo {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub album_art: Option<String>,
    pub duration: u64,
}

// Single lyric line
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricLine {
    pub start_time: i64,
    pub end_time: Option<i64>,
    pub text: String,           // Original text
    #[serde(default)]
    pub pron_text: Option<String>,  // Phonetic/romanized text
    #[serde(default)]
    pub trans_text: Option<String>, // Translation text
}

// Full lyrics data payload
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsData {
    pub track: TrackInfo,
    pub lyrics: Vec<LyricLine>,
    pub is_synced: bool,
}

// Progress sync data
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressData {
    pub position: u64,
    pub is_playing: bool,
    #[serde(default)]
    pub duration: Option<u64>,
    #[serde(default)]
    pub remaining: Option<f64>,
    #[serde(default)]
    pub next_track: Option<NextTrackInfo>,
}

// Next track info for preview
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NextTrackInfo {
    pub title: String,
    pub artist: String,
    pub album_art: Option<String>,
}

// Events to emit to frontend
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsEvent {
    pub lyrics_data: LyricsData,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub progress_data: ProgressData,
}

// Shared state for HTTP server
struct AppState<R: Runtime> {
    app_handle: AppHandle<R>,
}

// Internal state for lock logic
struct AppLockState {
    is_locked: bool,
    is_interactive: bool, // Track current interactive state to avoid spamming calls
    unlock_wait_time: f32, // Wait time in seconds before progress starts
    unlock_hold_time: f32, // Hold time in seconds to complete unlock
    enable_hover_unlock: bool, // Enable/disable hover unlock feature
}

// HTTP endpoint handlers
async fn handle_lyrics<R: Runtime>(
    axum::extract::State(state): axum::extract::State<Arc<AppState<R>>>,
    Json(lyrics_data): Json<LyricsData>,
) -> &'static str {
    // Emit to frontend
    let _ = state.app_handle.emit("lyrics-update", LyricsEvent { lyrics_data });
    "OK"
}

async fn handle_progress<R: Runtime>(
    axum::extract::State(state): axum::extract::State<Arc<AppState<R>>>,
    Json(progress_data): Json<ProgressData>,
) -> &'static str {
    // Emit to frontend
    let _ = state.app_handle.emit("progress-update", ProgressEvent { progress_data });
    "OK"
}

// Start HTTP server
async fn start_http_server<R: Runtime>(app_handle: AppHandle<R>) {
    let state = Arc::new(AppState { app_handle });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::POST, Method::GET, Method::OPTIONS])
        .allow_headers(Any);

    let app = Router::new()
        .route("/lyrics", post(handle_lyrics::<R>))
        .route("/progress", post(handle_progress::<R>))
        .layer(cors)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:15000")
        .await
        .expect("Failed to bind to port 15000");

    println!("HTTP server listening on http://127.0.0.1:15000");

    axum::serve(listener, app)
        .await
        .expect("HTTP server failed");
}

// Tauri command to start dragging window
#[tauri::command]
async fn start_drag(window: tauri::Window) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

// Tauri command to set ignore cursor events
#[tauri::command]
async fn set_ignore_cursor_events(window: tauri::Window, ignore: bool) -> Result<(), String> {
    window.set_ignore_cursor_events(ignore).map_err(|e| e.to_string())
}

// Tauri command to update lock state from frontend
// Tauri command to update lock state from frontend
#[tauri::command]
async fn set_lock_state(
    state: tauri::State<'_, Arc<Mutex<AppLockState>>>,
    locked: bool
) -> Result<(), String> {
    let mut s = state.lock().map_err(|e| e.to_string())?;
    s.is_locked = locked;
    Ok(())
}

// Tauri command to update unlock timing from frontend
#[tauri::command]
async fn set_unlock_timing(
    state: tauri::State<'_, Arc<Mutex<AppLockState>>>,
    wait_time: f32,
    hold_time: f32
) -> Result<(), String> {
    let mut s = state.lock().map_err(|e| e.to_string())?;
    s.unlock_wait_time = wait_time;
    s.unlock_hold_time = hold_time;
    Ok(())
}

// Tauri command to enable/disable hover unlock from frontend
#[tauri::command]
async fn set_hover_unlock_enabled(
    state: tauri::State<'_, Arc<Mutex<AppLockState>>>,
    enabled: bool
) -> Result<(), String> {
    let mut s = state.lock().map_err(|e| e.to_string())?;
    s.enable_hover_unlock = enabled;
    Ok(())
}


// Tauri command to open settings window
#[tauri::command]
async fn open_settings_window(app: AppHandle) -> Result<(), String> {
    // Check if settings window already exists
    if let Some(settings_window) = app.get_webview_window("settings") {
        settings_window.show().map_err(|e| e.to_string())?;
        settings_window.set_focus().map_err(|e| e.to_string())?;
        // Force reload to ensure correct query param
        settings_window.eval("window.location.replace('index.html?settings=true')").map_err(|e| e.to_string())?;
    } else {
        // Create new settings window
        let _settings_window = tauri::WebviewWindowBuilder::new(
            &app,
            "settings",
            tauri::WebviewUrl::App("index.html?settings=true".into())
        )
        .title("Settings")
        .inner_size(400.0, 600.0)
        .resizable(true)
        .decorations(true)
        .always_on_top(true)
        .build()
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// Tauri command to get system fonts
#[tauri::command]
fn get_system_fonts() -> Result<Vec<String>, String> {
    use font_kit::source::SystemSource;
    
    let source = SystemSource::new();
    let families = source.all_families().map_err(|e| e.to_string())?;
    
    let mut fonts: Vec<String> = families.into_iter().collect();
    fonts.sort();
    fonts.dedup();
    
    Ok(fonts)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Shared state specifically for the lock/hover logic
    let lock_state = Arc::new(Mutex::new(AppLockState { 
        is_locked: true, // Default to locked (pass-through)
        is_interactive: false,
        unlock_wait_time: 1.2, // Default: 1.2 seconds
        unlock_hold_time: 3.0, // Default: 3 seconds
        enable_hover_unlock: true, // Default: enabled
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build()) // Updater Init
        .plugin(tauri_plugin_window_state::Builder::default().build()) // Window State Persistence
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_deep_link::init()) // Deep Link / URL Scheme
        .manage(lock_state.clone()) // Manage properly in Tauri state
        .setup(move |app| {
            // Setup Tray Icon
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let settings_i = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let reset_pos_i = MenuItem::with_id(app, "reset_pos", "Reset Position", true, None::<&str>)?;
            let toggle_lock_i = MenuItem::with_id(app, "toggle_lock", "Lock/Unlock Toggle", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&toggle_lock_i, &settings_i, &reset_pos_i, &quit_i])?;

            // Get tray icon - use default_window_icon with proper error handling
            let tray_icon = app.default_window_icon()
                .cloned()
                .unwrap_or_else(|| {
                    // Fallback: include icon at compile time
                    let icon_bytes = include_bytes!("../icons/32x32.png");
                    let img = image::load_from_memory(icon_bytes).expect("Failed to load embedded icon");
                    let rgba = img.to_rgba8();
                    let (width, height) = rgba.dimensions();
                    tauri::image::Image::new_owned(rgba.into_raw(), width, height)
                });


            let _tray = TrayIconBuilder::new()
                .icon(tray_icon)
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "quit" => app.exit(0),
                        "reset_pos" => {
                             if let Some(window) = app.get_webview_window("main") {
                                 let _ = window.set_position(PhysicalPosition::new(100, 100));
                                 let _ = window.show();
                                 let _ = window.set_focus();
                             }
                        },
                        "settings" => {
                            if let Some(settings_window) = app.get_webview_window("settings") {
                                settings_window.show().unwrap();
                                settings_window.set_focus().unwrap();
                                let _ = settings_window.eval("window.location.replace('index.html?settings=true')");
                            } else {
                                let _ = tauri::WebviewWindowBuilder::new(
                                    app,
                                    "settings",
                                    tauri::WebviewUrl::App("index.html?settings=true".into())
                                )
                                .title("Settings")
                                .inner_size(400.0, 600.0)
                                .resizable(true)
                                .always_on_top(true)
                                .build();
                            }
                        },
                        "toggle_lock" => {
                             let state = app.state::<std::sync::Arc<std::sync::Mutex<AppLockState>>>();
                             let mut lock_state = state.lock().unwrap();
                             lock_state.is_locked = !lock_state.is_locked;
                             let new_locked = lock_state.is_locked;
                             
                             // Emit event to frontend to update UI
                             let _ = app.emit("lock-state-update", new_locked);
                        }
                        _ => {}
                    }
                })
                .build(app)?;


            // macOS Specific Configuration
            #[cfg(target_os = "macos")]
            #[allow(deprecated)]
            {
                use tauri::ActivationPolicy;
                app.set_activation_policy(ActivationPolicy::Accessory);

                use cocoa::appkit::{NSWindow, NSWindowCollectionBehavior, NSColor, NSWindowStyleMask, NSWindowTitleVisibility};
                use cocoa::base::{id, nil};

                if let Some(window) = app.get_webview_window("main") {
                    // Try to cast to NSWindow id
                    // Note: window.ns_window() returns a raw pointer/handle which we cast to id
                    let ns_window_handle = window.ns_window().unwrap();
                    let ns_window = ns_window_handle as id;
                    
                    unsafe {
                        // Force Transparency
                        ns_window.setOpaque_(cocoa::base::NO);
                        ns_window.setBackgroundColor_(NSColor::clearColor(nil));
                        ns_window.setHasShadow_(cocoa::base::NO);

                        // Ensure style mask allows full size content
                        let style_mask = ns_window.styleMask() | NSWindowStyleMask::NSFullSizeContentViewWindowMask;
                        ns_window.setStyleMask_(style_mask);

                        ns_window.setTitlebarAppearsTransparent_(cocoa::base::YES);
                        ns_window.setTitleVisibility_(NSWindowTitleVisibility::NSWindowTitleHidden);
                        
                        // Set Collection Behavior: CanJoinAllSpaces (1<<0) | Stationary (1<<4) | IgnoresCycle (1<<6)
                        // This makes it visible on all desktops and not participate in window cycling
                        let behavior = NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces |
                                       NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary |
                                       NSWindowCollectionBehavior::NSWindowCollectionBehaviorIgnoresCycle;
                        ns_window.setCollectionBehavior_(behavior);
                    }
                }
            }

            let app_handle = app.handle().clone();
            
            // Start HTTP server in background
            let app_handle_http = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                start_http_server(app_handle_http).await;
            });

            // Start Mouse Polling Thread
            let loop_lock_state = lock_state.clone();
            let loop_app_handle = app_handle.clone();

            std::thread::spawn(move || {
                let mut was_hovering = false;
                
                // For idle detection
                let mut last_mouse_x = 0;
                let mut last_mouse_y = 0;
                let mut idle_ticks = 0;
                let _max_idle_ticks = 30; // 30 * 100ms = 3 seconds

                loop {
                    std::thread::sleep(Duration::from_millis(100)); // Poll every 100ms

                    let mut current_hovering = false;
                    let mut current_x = 0;
                    let mut current_y = 0;
                    
                    // --- Windows Logic ---
                    #[cfg(target_os = "windows")]
                    {
                        if let Some(window) = loop_app_handle.get_webview_window("main") {
                            let mut point = POINT::default();
                            let success = unsafe { GetCursorPos(&mut point) };

                            if success.is_ok() {
                                if let (Ok(win_pos), Ok(win_size)) = (window.outer_position(), window.inner_size()) {
                                    let rel_x = point.x - win_pos.x;
                                    let rel_y = point.y - win_pos.y;
                                    
                                    current_x = point.x;
                                    current_y = point.y;

                                    // Check global hover
                                    current_hovering = rel_x >= 0 && rel_x < win_size.width as i32 && 
                                                      rel_y >= 0 && rel_y < win_size.height as i32;
                                    
                                    // Interactive Zone Logic (Keep pass-through if locked)
                                    {
                                        if let Ok(mut state) = loop_lock_state.lock() {
                                            if state.is_locked {
                                                if state.is_interactive {
                                                    let _ = window.set_ignore_cursor_events(true);
                                                    state.is_interactive = false;
                                                }
                                            } else {
                                                if !state.is_interactive {
                                                    let _ = window.set_ignore_cursor_events(false);
                                                    state.is_interactive = true;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // --- macOS Logic ---
                    #[cfg(target_os = "macos")]
                    {
                        use cocoa::base::{id, nil};
                        use cocoa::appkit::{NSEvent, NSWindow};

                        if let Some(window) = loop_app_handle.get_webview_window("main") {
                             #[allow(deprecated)]
                             unsafe {
                                let mouse_loc = NSEvent::mouseLocation(nil); 
                                let ns_window: id = window.ns_window().unwrap() as id;
                                let frame = ns_window.frame();
                                
                                current_x = mouse_loc.x as i32;
                                current_y = mouse_loc.y as i32;

                                current_hovering = mouse_loc.x >= frame.origin.x && 
                                                  mouse_loc.x <= (frame.origin.x + frame.size.width) &&
                                                  mouse_loc.y >= frame.origin.y && 
                                                  mouse_loc.y <= (frame.origin.y + frame.size.height);

                                if let Ok(mut state) = loop_lock_state.lock() {
                                    if state.is_locked {
                                        if state.is_interactive {
                                            let _ = window.set_ignore_cursor_events(true);
                                            state.is_interactive = false;
                                        }
                                    } else {
                                         if !state.is_interactive {
                                            let _ = window.set_ignore_cursor_events(false);
                                            state.is_interactive = true;
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // --- Common Logic ---
                    // 1. Emit Hover Event (Opacity Control)
                    if current_hovering != was_hovering {
                        was_hovering = current_hovering;
                        let _ = loop_app_handle.emit("overlay-hover", current_hovering);
                        
                        // Reset idle if left
                        if !current_hovering {
                            idle_ticks = 0;
                            let _ = loop_app_handle.emit("unlock-progress", 0);
                        }
                    }

                    // 2. Idle Detection (Unlock Progress)
                    // Only calculate if currently hovering AND LOCKED AND hover unlock is enabled
                    let (is_locked, wait_time, hold_time, hover_unlock_enabled) = loop_lock_state.lock()
                        .map(|s| (s.is_locked, s.unlock_wait_time, s.unlock_hold_time, s.enable_hover_unlock))
                        .unwrap_or((true, 1.2, 3.0, true));
                    
                    // Convert seconds to ticks (100ms per tick)
                    let wait_ticks = (wait_time * 10.0) as i32;
                    let hold_ticks = (hold_time * 10.0) as i32;
                    let total_ticks = wait_ticks + hold_ticks;

                    if current_hovering && is_locked && hover_unlock_enabled {
                        // Check if mouse moved significantly (allow small jitter approx 5px radius)
                        let dist_sq = (current_x - last_mouse_x).pow(2) + (current_y - last_mouse_y).pow(2);
                        
                        // Increase sensitivity check
                        if dist_sq < 25 { 
                            idle_ticks += 1;
                        } else {
                            idle_ticks = 0; // Moved -> Reset
                        }
                        
                        // Update last pos
                        last_mouse_x = current_x;
                        last_mouse_y = current_y;

                        // Calculate Progress
                        let progress = if idle_ticks < wait_ticks {
                            0.0
                        } else {
                            let effective_ticks = idle_ticks - wait_ticks;
                            ((effective_ticks as f32 / hold_ticks as f32) * 100.0).min(100.0)
                        };

                        let _ = loop_app_handle.emit("unlock-progress", progress);

                        if idle_ticks >= total_ticks {
                            // Trigger Unlock
                             if let Ok(mut state) = loop_lock_state.lock() {
                                 state.is_locked = false;
                                 let _ = loop_app_handle.emit("lock-state-update", false);
                                 // Force reset ticks to avoid repeated toggling
                                 idle_ticks = 0;
                             }
                        }

                    } else {
                        // Not hovering or Not locked
                        if idle_ticks > 0 {
                            idle_ticks = 0;
                            let _ = loop_app_handle.emit("unlock-progress", 0.0);
                        }
                        last_mouse_x = current_x;
                        last_mouse_y = current_y;
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_drag,
            open_settings_window,
            set_ignore_cursor_events,
            set_lock_state,
            set_unlock_timing,
            set_hover_unlock_enabled,
            get_system_fonts
        ])

        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
