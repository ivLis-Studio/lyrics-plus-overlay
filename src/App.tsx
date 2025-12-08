import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import "./App.css";
import type { TrackInfo, LyricLine, LyricsEvent, ProgressEvent } from "./types";

// Default settings
const defaultSettings = {
  showOriginal: true,
  showPhonetic: true,
  showTranslation: true,
  showTrackInfo: true,

  // Font Sizes (px)
  originalFontSize: 24,
  phoneticFontSize: 14,
  translationFontSize: 16,
  padding: 12, // Keep property for type compatibility but set fixed default

  // Font Weights
  originalFontWeight: '700',
  phoneticFontWeight: '500',
  translationFontWeight: '500',
  trackInfoFontSize: 13,
  trackInfoFontWeight: '600',
  trackInfoOpacity: 90,

  // Animation
  animationType: 'slide' as 'fade' | 'slide' | 'scale' | 'none',
  animationDuration: 300, // ms

  lineBackgroundOpacity: 60,
  textColor: '#ffffff',
  activeColor: '#1db954',
  phoneticColor: '#cccccc',
  translationColor: '#aaaaaa',
  backgroundColor: '#000000',
  borderRadius: 12,
  lineGap: 6, // Spacing between lyric lines (Original <-> Phonetic <-> Translation)
  textAlign: 'center' as 'left' | 'center' | 'right',
  isLocked: true, // Default to locked
  language: 'ko' as 'ko' | 'en', // UI Language

  // New Styles
  textStroke: false,
  textShadow: 'none' as 'none' | 'soft' | 'hard',
};

// Settings Tab Categories
type SettingsTab = 'general' | 'display' | 'style' | 'animation';

export type OverlaySettings = typeof defaultSettings;
export { defaultSettings };

// Localization Data
const strings = {
  ko: {
    // Tabs
    tabGeneral: "일반",
    tabDisplay: "화면",
    tabStyle: "스타일",
    tabAnim: "효과",

    settingsTitle: "설정",
    displaySection: "표시 설정",
    showSection: "표시 요소",
    layoutSection: "레이아웃",
    typoSection: "서체 설정",
    animSection: "애니메이션 설정",
    originalLyrics: "원문 가사",
    phoneticLyrics: "발음/로마자",
    translationLyrics: "번역",
    trackInfo: "트랙 정보",
    alignmentSection: "정렬",
    alignLeft: "좌측",
    alignCenter: "중앙",
    alignRight: "우측",
    styleSection: "스타일",
    fontSize: "글자 크기",
    bgOpacity: "배경 투명도",
    enableAnimation: "가사 애니메이션",
    startOnBoot: "부팅 시 자동 시작",
    radius: "테두리 둥글기",
    padding: "컨테이너 여백",
    lineGap: "줄 간격",
    colorSection: "색상",
    originalColor: "원문 색상",
    phoneticColor: "발음 색상",
    transColor: "번역 색상",
    bgColor: "배경 색상",
    reset: "설정 초기화",
    resetConfirm: "정말 초기화하시겠습니까?", // ADDED
    waiting: "가사 대기 중...",
    lockTooltip: "잠그기",
    holdToUnlock: "마우스를 2초간 올려두면 잠금해제됩니다",

    // New Strings
    textStyleSection: "텍스트 스타일",
    animationSection: "애니메이션",
    originalStyle: "원문 스타일",
    phoneticStyle: "발음 스타일",
    transStyle: "번역 스타일",
    // Style - Effects
    effectSection: "텍스트 효과",
    textStroke: "외곽선 (Stroke)",
    textShadow: "그림자",
    shadowNone: "없음",
    shadowSoft: "부드럽게",
    shadowHard: "선명하게",

    trackInfoStyle: "트랙 정보 스타일",
    size: "크기",
    opacity: "투명도",
    weight: "굵기",
    animType: "효과",
    animDuration: "속도",
    animFade: "페이드",
    animSlide: "슬라이드",
    animScale: "확대/축소",
    animNone: "없음",
    ms: "ms",
  },
  en: {
    // Tabs
    tabGeneral: "General",
    tabDisplay: "Display",
    tabStyle: "Style",
    tabAnim: "Effects",

    settingsTitle: "Settings",
    displaySection: "DISPLAY",
    showSection: "Elements",
    layoutSection: "Layout",
    typoSection: "Typography",
    animSection: "Animation Settings",
    originalLyrics: "Original Lyrics",
    phoneticLyrics: "Phonetic / Romanization",
    translationLyrics: "Translation",
    trackInfo: "Track Info",
    alignmentSection: "ALIGNMENT",
    alignLeft: "Left",
    alignCenter: "Center",
    alignRight: "Right",
    styleSection: "STYLE",
    fontSize: "Font Size",
    bgOpacity: "Background Opacity",
    enableAnimation: "Lyric Animation",
    startOnBoot: "Start on Boot",
    radius: "Corner Radius",
    padding: "Container Padding",
    lineGap: "Line Spacing",
    colorSection: "COLORS",
    originalColor: "Original Text",
    phoneticColor: "Phonetic Text",
    transColor: "Translation Text",
    bgColor: "Background",
    reset: "Reset to Defaults",
    resetConfirm: "Are you sure?", // ADDED
    waiting: "Waiting for lyrics...",
    lockTooltip: "Lock",
    holdToUnlock: "Hold for 2s to Unlock",

    // New Strings
    textStyleSection: "TEXT STYLES",
    animationSection: "ANIMATION",
    originalStyle: "Original Text",
    phoneticStyle: "Phonetic Text",
    transStyle: "Translation",
    // Style - Effects
    effectSection: "Text Effects",
    textStroke: "Outline",
    textShadow: "Shadow",
    shadowNone: "None",
    shadowSoft: "Soft",
    shadowHard: "Hard",

    trackInfoStyle: "Track Info Style",
    size: "Size",
    opacity: "Opacity",
    weight: "Weight",
    animType: "Effect",
    animDuration: "Duration",
    animFade: "Fade",
    animSlide: "Slide",
    animScale: "Scale",
    animNone: "None",
    ms: "ms",
  }
};

function App() {
  // Check if this is the settings window
  const isSettingsWindow = window.location.search.includes('settings=true');

  const [track, setTrack] = useState<TrackInfo | null>(null);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [settings, setSettings] = useState<OverlaySettings>(() => {
    const saved = localStorage.getItem('overlay-settings-v3');
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });

  const containerRef = useRef<HTMLDivElement>(null);

  // Unlock interaction state
  const [unlockProgress, setUnlockProgress] = useState(0);
  const unlockTimerRef = useRef<number | null>(null);
  const unlockStartTimeRef = useRef<number | null>(null);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('overlay-settings-v3', JSON.stringify(settings));
  }, [settings]);

  // Listen for settings changes from other windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'overlay-settings-v3' && e.newValue) {
        setSettings({ ...defaultSettings, ...JSON.parse(e.newValue) });
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Find active lyric line index
  const activeLineIndex = useMemo(() => {
    if (lyrics.length === 0) return -1;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (progress >= lyrics[i].startTime) {
        return i;
      }
    }
    return -1;
  }, [lyrics, progress]);

  // Get the active lyric line only
  const activeLine = useMemo(() => {
    if (activeLineIndex < 0 || activeLineIndex >= lyrics.length) return null;
    return lyrics[activeLineIndex];
  }, [lyrics, activeLineIndex]);

  // Listen for events from Rust backend
  useEffect(() => {
    const unlistenLyrics = listen<LyricsEvent>("lyrics-update", (event) => {
      const payload = event.payload;
      if (payload.lyricsData) {
        setTrack(payload.lyricsData.track);
        setLyrics(payload.lyricsData.lyrics);
      }
    });

    const unlistenProgress = listen<ProgressEvent>("progress-update", (event) => {
      const payload = event.payload;
      if (payload.progressData) {
        setProgress(payload.progressData.position);
        setIsPlaying(payload.progressData.isPlaying);
      }
    });

    // Listen for lock state changes from Tray
    const unlistenLockUpdate = listen<boolean>("lock-state-update", (event) => {
      setSettings(prev => ({ ...prev, isLocked: event.payload }));
    });

    // Initial setup: Sync lock state with backend
    if (!isSettingsWindow) {
      // Default is locked
      invoke('set_lock_state', { locked: settings.isLocked }).catch(console.error);
    }

    return () => {
      unlistenLyrics.then((fn) => fn());
      unlistenProgress.then((fn) => fn());
      unlistenLockUpdate.then((fn) => fn());
    };
  }, []); // Run once

  // Sync lock state when settings change
  useEffect(() => {
    if (!isSettingsWindow) {
      invoke('set_lock_state', { locked: settings.isLocked }).catch(console.error);
      // Also set ignore events manually based on lock state to allow dragging in unlocked mode immediately
      if (!settings.isLocked) {
        invoke('set_ignore_cursor_events', { ignore: false }).catch(console.error);
      }
    }
  }, [settings.isLocked, isSettingsWindow]);

  // Drag functionality - only when unlocked
  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    if (settings.isLocked) return;

    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, .control-group')) return;

    try {
      await invoke('start_drag');
    } catch (err) {
      console.error('Failed to start dragging:', err);
    }
  }, [settings.isLocked]);

  // Open settings window
  const openSettings = useCallback(async () => {
    try {
      await invoke('open_settings_window');
    } catch (err) {
      console.error('Failed to open settings:', err);
    }
  }, []);

  // Toggle lock state
  const toggleLock = useCallback(() => {
    setSettings(prev => ({ ...prev, isLocked: !prev.isLocked }));
  }, []);

  // Get display text
  const getDisplayText = (line: LyricLine) => {
    const hasPronText = line.pronText && line.pronText !== line.text;
    const hasTransText = line.transText && line.transText !== line.text;
    return {
      main: line.text || '',
      phonetic: hasPronText ? line.pronText : null,
      translation: hasTransText ? line.transText : null,
    };
  };

  // If this is the settings window, render settings UI
  if (isSettingsWindow) {
    return <SettingsPanel settings={settings} onSettingsChange={setSettings} />;
  }

  // Convert hex to rgba
  const hexToRgba = (hex: string, opacity: number) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    }
    return hex;
  };

  const display = activeLine ? getDisplayText(activeLine) : null;
  const t = strings[settings.language || 'ko'];

  // Alignment classes
  const alignClass = settings.textAlign === 'left' ? 'align-left' :
    settings.textAlign === 'right' ? 'align-right' : 'align-center';

  return (
    <div
      ref={containerRef}
      className={`overlay-container ${!isPlaying ? 'paused' : ''} ${alignClass} ${settings.isLocked ? 'locked' : 'unlocked'}`}
      onMouseDown={handleMouseDown}
      style={{
        '--original-size': `${settings.originalFontSize}px`,
        '--phonetic-size': `${settings.phoneticFontSize}px`,
        '--translation-size': `${settings.translationFontSize}px`,
        '--original-weight': settings.originalFontWeight,
        '--phonetic-weight': settings.phoneticFontWeight,
        '--translation-weight': settings.translationFontWeight,
        '--text-color': settings.textColor,
        '--active-color': settings.activeColor,
        '--phonetic-color': settings.phoneticColor,
        '--translation-color': settings.translationColor,
        '--line-bg': hexToRgba(settings.backgroundColor, settings.lineBackgroundOpacity / 100),
        '--track-info-size': `${settings.trackInfoFontSize}px`,
        '--track-info-weight': settings.trackInfoFontWeight,
        '--track-info-opacity': settings.trackInfoOpacity / 100,
        '--border-radius': `${settings.borderRadius}px`,
        '--padding': `${settings.padding}px`,
        '--line-gap': `${settings.lineGap}px`,
        '--anim-duration': `${settings.animationDuration}ms`,
        '--text-shadow': settings.textShadow === 'soft' ? '0 2px 4px rgba(0,0,0,0.5)' :
          settings.textShadow === 'hard' ? '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' : 'none',
        '--text-stroke': settings.textStroke ? '1px black' : 'none',
      } as React.CSSProperties}
    >
      <div
        className="trigger-zone"
        title="Hover for controls"
      /* Interactive logic handled by Rust backend polling */
      ></div>
      {/* Control Buttons Group (Visible on Hover) */}
      <div
        className="control-group"
      >
        {/* Lock/Unlock Toggle with Hold Logic */}
        <div style={{ position: 'relative' }}>
          <button
            className="icon-btn lock-toggle"
            onClick={() => !settings.isLocked && toggleLock()}
            onMouseEnter={() => {
              if (settings.isLocked) {
                // Reset
                setUnlockProgress(0);
                unlockStartTimeRef.current = Date.now();

                const animate = () => {
                  const elapsed = Date.now() - (unlockStartTimeRef.current || 0);
                  const duration = 2000; // 2 seconds
                  const progress = Math.min(elapsed / duration, 1);

                  setUnlockProgress(progress * 100);

                  if (progress < 1) {
                    unlockTimerRef.current = requestAnimationFrame(animate);
                  } else {
                    toggleLock();
                    setUnlockProgress(0);
                    unlockTimerRef.current = null;
                  }
                };
                unlockTimerRef.current = requestAnimationFrame(animate);
              }
            }}
            onMouseLeave={() => {
              if (unlockTimerRef.current) {
                cancelAnimationFrame(unlockTimerRef.current);
                unlockTimerRef.current = null;
              }
              setUnlockProgress(0);
            }}
            title={settings.isLocked ? "" : t.lockTooltip || "Lock"} // Disable native tooltip on lock to use custom one
            style={{ position: 'relative' }}
          >
            {settings.isLocked ? "🔒" : "🔓"}

            {/* Hold Gauge */}
            {settings.isLocked && (
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  pointerEvents: 'none',
                  transform: 'rotate(-90deg)',
                  overflow: 'visible'
                }}
              >
                {/* Background Track */}
                <circle
                  cx="16"
                  cy="16"
                  r="15"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="2"
                  fill="transparent"
                />
                {/* Progress Circle */}
                <circle
                  cx="16"
                  cy="16"
                  r="15"
                  stroke={settings.activeColor}
                  strokeWidth="2"
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 15}`}
                  strokeDashoffset={`${2 * Math.PI * 15 * (1 - unlockProgress / 100)}`}
                  strokeLinecap="round"
                  style={{
                    transition: 'stroke-dashoffset 0.1s linear, stroke 0.3s ease'
                  }}
                />
              </svg>
            )}
          </button>

          {/* Custom Tooltip */}
          {settings.isLocked && unlockProgress > 0 && (
            <div className="hold-tooltip">
              {t.holdToUnlock}
            </div>
          )}
        </div>

        {/* Settings Button (Only visible when unlocked) */}
        {!settings.isLocked && (
          <button className="icon-btn settings-toggle" onClick={openSettings} title="Settings">
            ⚙️
          </button>
        )}
      </div>

      {/* Track Info */}
      {
        settings.showTrackInfo && track && (
          <div className="track-info-line">
            {track.albumArt && (
              <img src={track.albumArt} alt="" className="album-art" />
            )}
            <span className="track-text">
              {track.artist} - {track.title}
            </span>
          </div>
        )
      }

      {/* Lyrics - Only active line */}
      {/* Lyrics - Keyed by text/time to trigger animation */}
      {
        display ? (
          <div
            className={`lyrics-box anim-${settings.animationType}`}
            key={activeLine?.startTime || 'empty'}
          >
            {/* Original */}
            {settings.showOriginal && display.main && (
              <div className="lyric-line original">{display.main}</div>
            )}
            {/* Phonetic */}
            {settings.showPhonetic && display.phonetic && (
              <div className="lyric-line phonetic">{display.phonetic}</div>
            )}
            {/* Translation */}
            {settings.showTranslation && display.translation && (
              <div className="lyric-line translation">{display.translation}</div>
            )}
          </div>
        ) : (
          <div className="lyrics-box waiting">
            {track ? "🎵" : `🎧 ${t.waiting}`}
          </div>
        )
      }
    </div >
  );
}

// Settings Panel Component
function SettingsPanel({
  settings,
  onSettingsChange
}: {
  settings: OverlaySettings;
  onSettingsChange: (s: OverlaySettings) => void;
}) {
  const t = strings[settings.language || 'ko'];
  const [autoStart, setAutoStart] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  useEffect(() => {
    isEnabled().then(setAutoStart).catch(e => console.error("Failed to check autostart:", e));
  }, []);

  const toggleAutoStart = async (checked: boolean) => {
    try {
      if (checked) {
        await enable();
      } else {
        await disable();
      }
      setAutoStart(checked);
    } catch (e) {
      console.error("Failed to toggle autostart:", e);
    }
  };

  const updateSetting = <K extends keyof OverlaySettings>(key: K, value: OverlaySettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const toggleLanguage = () => {
    updateSetting('language', settings.language === 'en' ? 'ko' : 'en');
  };

  return (
    <div className={`settings-panel ios-style ${!settings.isLocked ? 'open' : ''}`}>
      <div className="settings-header">
        <h2>{t.settingsTitle}</h2>
        <button className="lang-toggle-btn" onClick={toggleLanguage}>
          {settings.language === 'en' ? 'US' : 'KO'}
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="ios-segmented-control" style={{ margin: '0 20px 16px', width: 'auto' }}>
        {(['general', 'display', 'style', 'animation'] as SettingsTab[]).map(tab => (
          <button
            key={tab}
            className={activeTab === tab ? 'active' : ''}
            onClick={() => setActiveTab(tab)}
            style={{ padding: '6px 0', fontSize: '13px' }}
          >
            {
              tab === 'general' ? t.tabGeneral :
                tab === 'display' ? t.tabDisplay :
                  tab === 'style' ? t.tabStyle : t.tabAnim
            }
          </button>
        ))}
      </div>

      <div className="settings-content">

        {/* ================= GENERAL TAB ================= */}
        {activeTab === 'general' && (
          <section className="ios-section">
            <div className="section-header">{t.tabGeneral}</div>
            <div className="ios-list">
              <label className="ios-item">
                <span>{t.startOnBoot}</span>
                <div className="toggle-wrapper">
                  <input
                    type="checkbox"
                    checked={autoStart}
                    onChange={(e) => toggleAutoStart(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </div>
              </label>

              <div className="ios-item column">
                <button
                  className="ios-button destructive"
                  onClick={() => {
                    if (confirm(t.resetConfirm)) onSettingsChange({ ...defaultSettings, language: settings.language });
                  }}
                >
                  {t.reset}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ================= DISPLAY TAB ================= */}
        {activeTab === 'display' && (
          <>
            <section className="ios-section">
              <div className="section-header">{t.showSection}</div>
              <div className="ios-list">
                <label className="ios-item">
                  <span>{t.originalLyrics}</span>
                  <div className="toggle-wrapper">
                    <input type="checkbox" checked={settings.showOriginal} onChange={(e) => updateSetting('showOriginal', e.target.checked)} />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
                <label className="ios-item">
                  <span>{t.phoneticLyrics}</span>
                  <div className="toggle-wrapper">
                    <input type="checkbox" checked={settings.showPhonetic} onChange={(e) => updateSetting('showPhonetic', e.target.checked)} />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
                <label className="ios-item">
                  <span>{t.translationLyrics}</span>
                  <div className="toggle-wrapper">
                    <input type="checkbox" checked={settings.showTranslation} onChange={(e) => updateSetting('showTranslation', e.target.checked)} />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
                <label className="ios-item">
                  <span>{t.trackInfo}</span>
                  <div className="toggle-wrapper">
                    <input type="checkbox" checked={settings.showTrackInfo} onChange={(e) => updateSetting('showTrackInfo', e.target.checked)} />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
              </div>
            </section>

            <section className="ios-section">
              <div className="section-header">{t.layoutSection}</div>
              {/* Alignment */}
              <div className="ios-list">
                <div className="ios-item column">
                  <div className="item-row">
                    <span>{t.alignmentSection}</span>
                  </div>
                  <div className="ios-segmented-control">
                    <button className={settings.textAlign === 'left' ? 'active' : ''} onClick={() => updateSetting('textAlign', 'left')}>{t.alignLeft}</button>
                    <button className={settings.textAlign === 'center' ? 'active' : ''} onClick={() => updateSetting('textAlign', 'center')}>{t.alignCenter}</button>
                    <button className={settings.textAlign === 'right' ? 'active' : ''} onClick={() => updateSetting('textAlign', 'right')}>{t.alignRight}</button>
                  </div>
                </div>
                {/* Line Gap */}
                <div className="ios-item column">
                  <div className="item-row">
                    <span>{t.lineGap}</span>
                    <span className="value-text">{settings.lineGap}px</span>
                  </div>
                  <input type="range" min="0" max="40" value={settings.lineGap} onChange={(e) => updateSetting('lineGap', parseInt(e.target.value))} />
                </div>
              </div>
            </section>
          </>
        )}

        {/* ================= STYLE TAB ================= */}
        {activeTab === 'style' && (
          <>
            {/* Typography */}
            <section className="ios-section">
              <div className="section-header">{t.typoSection}</div>
              <div className="ios-list">
                {/* Original */}
                <div className="ios-item column">
                  <div className="item-row">
                    <span>{t.originalStyle}</span>
                    <span className="value-text">{settings.originalFontSize}px / {settings.originalFontWeight}</span>
                  </div>
                  <div className="slider-group">
                    <input type="range" min="12" max="64" value={settings.originalFontSize} onChange={(e) => updateSetting('originalFontSize', parseInt(e.target.value))} />
                    <select className="ios-select" value={settings.originalFontWeight} onChange={(e) => updateSetting('originalFontWeight', e.target.value)}>
                      <option value="300">Light</option><option value="400">Regular</option><option value="700">Bold</option><option value="900">Heavy</option>
                    </select>
                  </div>
                </div>
                {/* Phonetic */}
                <div className="ios-item column">
                  <div className="item-row">
                    <span>{t.phoneticStyle}</span>
                    <span className="value-text">{settings.phoneticFontSize}px / {settings.phoneticFontWeight}</span>
                  </div>
                  <div className="slider-group">
                    <input type="range" min="10" max="40" value={settings.phoneticFontSize} onChange={(e) => updateSetting('phoneticFontSize', parseInt(e.target.value))} />
                    <select className="ios-select" value={settings.phoneticFontWeight} onChange={(e) => updateSetting('phoneticFontWeight', e.target.value)}>
                      <option value="300">Light</option><option value="400">Regular</option><option value="500">Medium</option><option value="700">Bold</option>
                    </select>
                  </div>
                </div>
                {/* Translation */}
                <div className="ios-item column">
                  <div className="item-row">
                    <span>{t.transStyle}</span>
                    <span className="value-text">{settings.translationFontSize}px / {settings.translationFontWeight}</span>
                  </div>
                  <div className="slider-group">
                    <input type="range" min="10" max="40" value={settings.translationFontSize} onChange={(e) => updateSetting('translationFontSize', parseInt(e.target.value))} />
                    <select className="ios-select" value={settings.translationFontWeight} onChange={(e) => updateSetting('translationFontWeight', e.target.value)}>
                      <option value="300">Light</option><option value="400">Regular</option><option value="500">Medium</option><option value="700">Bold</option>
                    </select>
                  </div>
                </div>
                {/* Track Info */}
                <div className="ios-item column">
                  <div className="item-row">
                    <span>{t.trackInfoStyle}</span>
                    <span className="value-text">{settings.trackInfoFontSize}px</span>
                  </div>
                  <div className="slider-group">
                    <input type="range" min="10" max="32" value={settings.trackInfoFontSize} onChange={(e) => updateSetting('trackInfoFontSize', parseInt(e.target.value))} />
                    <select className="ios-select" value={settings.trackInfoFontWeight} onChange={(e) => updateSetting('trackInfoFontWeight', e.target.value)}>
                      <option value="400">Regular</option><option value="600">Semi-Bold</option><option value="700">Bold</option>
                    </select>
                  </div>
                </div>
              </div>
            </section>

            <section className="ios-section">
              <div className="section-header">{t.effectSection}</div>
              <div className="ios-list">
                <label className="ios-item">
                  <span>{t.textStroke}</span>
                  <div className="toggle-wrapper">
                    <input type="checkbox" checked={settings.textStroke} onChange={(e) => updateSetting('textStroke', e.target.checked)} />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
                <div className="ios-item column">
                  <div className="item-row"><span>{t.textShadow}</span></div>
                  <div className="ios-segmented-control">
                    <button className={settings.textShadow === 'none' ? 'active' : ''} onClick={() => updateSetting('textShadow', 'none')}>{t.shadowNone}</button>
                    <button className={settings.textShadow === 'soft' ? 'active' : ''} onClick={() => updateSetting('textShadow', 'soft')}>{t.shadowSoft}</button>
                    <button className={settings.textShadow === 'hard' ? 'active' : ''} onClick={() => updateSetting('textShadow', 'hard')}>{t.shadowHard}</button>
                  </div>
                </div>
              </div>
            </section>

            {/* Colors & Appearance */}
            <section className="ios-section">
              <div className="section-header">{t.colorSection}</div>
              <div className="ios-list">
                <div className="ios-item">
                  <span>{t.originalColor}</span>
                  <div className="color-wrapper">
                    <input type="color" value={settings.activeColor} onChange={(e) => updateSetting('activeColor', e.target.value)} />
                    <div className="color-preview" style={{ background: settings.activeColor }}></div>
                  </div>
                </div>
                <div className="ios-item">
                  <span>{t.phoneticColor}</span>
                  <div className="color-wrapper">
                    <input type="color" value={settings.phoneticColor} onChange={(e) => updateSetting('phoneticColor', e.target.value)} />
                    <div className="color-preview" style={{ background: settings.phoneticColor }}></div>
                  </div>
                </div>
                <div className="ios-item">
                  <span>{t.transColor}</span>
                  <div className="color-wrapper">
                    <input type="color" value={settings.translationColor} onChange={(e) => updateSetting('translationColor', e.target.value)} />
                    <div className="color-preview" style={{ background: settings.translationColor }}></div>
                  </div>
                </div>
                <div className="ios-item">
                  <span>{t.bgColor}</span>
                  <div className="color-wrapper">
                    <input type="color" value={settings.backgroundColor} onChange={(e) => updateSetting('backgroundColor', e.target.value)} />
                    <div className="color-preview" style={{ background: settings.backgroundColor }}></div>
                  </div>
                </div>
                <div className="ios-item column">
                  <div className="item-row">
                    <span>{t.bgOpacity}</span>
                    <span className="value-text">{settings.lineBackgroundOpacity}%</span>
                  </div>
                  <input type="range" min="0" max="100" value={settings.lineBackgroundOpacity} onChange={(e) => updateSetting('lineBackgroundOpacity', parseInt(e.target.value))} />
                </div>
                <div className="ios-item column">
                  <div className="item-row">
                    <span>{t.radius}</span>
                    <span className="value-text">{settings.borderRadius}px</span>
                  </div>
                  <input type="range" min="0" max="30" value={settings.borderRadius} onChange={(e) => updateSetting('borderRadius', parseInt(e.target.value))} />
                </div>
              </div>
            </section>
          </>
        )}

        {/* ================= ANIMATION TAB ================= */}
        {activeTab === 'animation' && (
          <section className="ios-section">
            <div className="section-header">{t.animSection}</div>
            <div className="ios-list">
              <div className="ios-item column">
                <div className="item-row">
                  <span>{t.animType}</span>
                </div>
                <div className="ios-segmented-control">
                  {(['fade', 'slide', 'scale', 'none'] as const).map(type => (
                    <button
                      key={type}
                      className={settings.animationType === type ? 'active' : ''}
                      onClick={() => updateSetting('animationType', type)}
                    >
                      {t[('anim' + type.charAt(0).toUpperCase() + type.slice(1)) as keyof typeof t]}
                    </button>
                  ))}
                </div>
              </div>

              {settings.animationType !== 'none' && (
                <div className="ios-item column">
                  <div className="item-row">
                    <span>{t.animDuration}</span>
                    <span className="value-text">{settings.animationDuration}ms</span>
                  </div>
                  <input
                    type="range" min="100" max="1000" step="50"
                    value={settings.animationDuration}
                    onChange={(e) => updateSetting('animationDuration', parseInt(e.target.value))}
                  />
                </div>
              )}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}

export default App;
