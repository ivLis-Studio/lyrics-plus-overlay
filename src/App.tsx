import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
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
  originalFontWeight: "700",
  phoneticFontWeight: "500",
  translationFontWeight: "500",

  // Animation
  animationType: "slide" as "fade" | "slide" | "scale" | "none",
  animationDuration: 300, // ms

  // Lyrics Styling
  lineBackgroundOpacity: 60,
  textColor: "#ffffff",
  activeColor: "#1db954",
  phoneticColor: "#cccccc",
  translationColor: "#aaaaaa",
  backgroundColor: "#000000",
  borderRadius: 12,
  lineGap: 6,
  textAlign: "center" as "left" | "center" | "right",
  isLocked: true,
  language: "ko" as "ko" | "en",

  // Text Effects
  textStroke: false,
  textStrokeSize: 1,
  textStrokeMode: "outer" as "inner" | "outer",
  textShadow: "none" as "none" | "soft" | "hard",

  // Track Info (곡 정보) Styling
  trackInfoFontSize: 13,
  trackInfoFontWeight: "600",
  trackInfoColor: "#ffffff",
  trackInfoBgColor: "#000000",
  trackInfoBgOpacity: 60,
  trackInfoBorderRadius: 12,

  // Font Families
  originalFontFamily: "",
  phoneticFontFamily: "",
  translationFontFamily: "",

  // Background Mode
  backgroundMode: "transparent" as "transparent" | "solid",
  solidBackgroundColor: "#000000",
  solidBackgroundOpacity: 50,

  // Visibility Options
  hideWhenPaused: false,
  showNextTrack: true,
  nextTrackSeconds: 15,

  // Element Order (곡정보, 원어, 발음, 번역 순서)
  elementOrder: ["trackInfo", "original", "phonetic", "translation"] as string[],

  // Unlock Timing (seconds)
  enableHoverUnlock: true, // 호버로 잠금해제 기능 활성화
  unlockWaitTime: 1.2, // 대기 시간 (초)
  unlockHoldTime: 3.0, // 홀드 시간 (초)

  // Album Art Customization
  albumArtSize: 36, // px
  albumArtBorderRadius: 8, // px

  // Layout Customization
  overlayMaxWidth: 500, // px (0 = no limit)
  sectionGap: 8, // gap between track info and lyrics
};

// Settings Tab Categories
type SettingsTab = "general" | "display" | "style" | "animation";

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
    waiting: "연결 대기 중",
    lockTooltip: "잠그기",
    holdToUnlock: "마우스를 2초간 올려두면 잠금해제됩니다",
    checkForUpdates: "업데이트 확인",
    upToDate: "최신 버전입니다.",
    checking: "확인 중...",
    updateAvailable: "새로운 버전({version})이 있습니다!",
    installUpdate: "설치 후 재시작하시겠습니까?",
    errorParams: "오류",
    downloading: "다운로드 중...",

    // New Strings
    textStyleSection: "텍스트 스타일",
    animationSection: "애니메이션",
    originalStyle: "원문",
    phoneticStyle: "발음",
    transStyle: "번역",
    // Style - Effects
    effectSection: "텍스트 효과",
    textStroke: "외곽선",
    strokeSize: "외곽선 두께",
    strokeMode: "외곽선 방향",
    strokeInner: "안쪽",
    strokeOuter: "바깥쪽",
    textShadow: "그림자",
    shadowNone: "없음",
    shadowSoft: "부드럽게",
    shadowHard: "선명하게",

    // 곡 정보 (Song Info) - unified terminology
    songInfoSection: "곡 정보",
    songInfoColor: "글자 색",
    songInfoBgColor: "배경 색",
    songInfoBg: "배경 투명도",
    songInfoRadius: "모서리 둥글기",
    size: "크기",
    weight: "굵기",
    animType: "효과",
    animDuration: "속도",
    animFade: "페이드",
    animSlide: "슬라이드",
    animScale: "확대/축소",
    animNone: "없음",
    ms: "ms",
    // Modal
    cancel: "취소",
    install: "설치",
    close: "닫기",
    // Font
    fontFamily: "글꼴",
    systemDefault: "시스템 기본",
    // Colors Section
    lyricsColorSection: "가사 색상",
    // Background Mode
    backgroundModeSection: "배경 모드",
    bgModeTransparent: "투명",
    bgModeSolid: "단색",
    solidBgColor: "배경 색상",
    solidBgOpacity: "배경 투명도",
    // Visibility
    visibilitySection: "표시 옵션",
    hideWhenPaused: "일시정지 시 숨기기",
    showNextTrack: "다음 곡 미리보기",
    nextTrackSeconds: "다음 곡 표시 시간",
    nextTrackLabel: "다음 곡",
    seconds: "초",
    // Element Order
    elementOrderSection: "요소 순서",
    elementTrackInfo: "곡 정보",
    elementOriginal: "원어",
    elementPhonetic: "발음",
    elementTranslation: "번역",
    moveUp: "↑",
    moveDown: "↓",
    // Unlock Timing
    unlockTimingSection: "잠금해제",
    enableHoverUnlock: "호버로 잠금해제",
    unlockWaitTime: "대기 시간",
    unlockHoldTime: "홀드 시간",
    // Album Art
    albumArtSection: "앨범아트",
    albumArtSize: "크기",
    albumArtBorderRadius: "모서리 둥글기",
    // Layout
    overlayMaxWidth: "최대 너비",
    sectionGap: "섹션 간격",
    noLimit: "제한 없음",
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
    waiting: "Connecting",
    lockTooltip: "Lock",
    holdToUnlock: "Hold for 2s to Unlock",
    checkForUpdates: "Check for Updates",
    upToDate: "You are on the latest version.",
    checking: "Checking...",
    updateAvailable: "New version ({version}) available!",
    installUpdate: "Install and restart?",
    errorParams: "Error",
    downloading: "Downloading...",

    // New Strings
    textStyleSection: "TEXT STYLES",
    animationSection: "ANIMATION",
    originalStyle: "Original",
    phoneticStyle: "Phonetic",
    transStyle: "Translation",
    // Style - Effects
    effectSection: "Text Effects",
    textStroke: "Outline",
    strokeSize: "Stroke Size",
    strokeMode: "Stroke Mode",
    strokeInner: "Inner",
    strokeOuter: "Outer",
    textShadow: "Shadow",
    shadowNone: "None",
    shadowSoft: "Soft",
    shadowHard: "Hard",

    // Song Info - unified terminology
    songInfoSection: "Song Info",
    songInfoColor: "Text Color",
    songInfoBgColor: "Background Color",
    songInfoBg: "Background Opacity",
    songInfoRadius: "Corner Radius",
    size: "Size",
    weight: "Weight",
    animType: "Effect",
    animDuration: "Duration",
    animFade: "Fade",
    animSlide: "Slide",
    animScale: "Scale",
    animNone: "None",
    ms: "ms",
    // Modal
    cancel: "Cancel",
    install: "Install",
    close: "Close",
    // Font
    fontFamily: "Font",
    systemDefault: "System Default",
    // Colors Section
    lyricsColorSection: "Lyrics Colors",
    // Background Mode
    backgroundModeSection: "Background Mode",
    bgModeTransparent: "Transparent",
    bgModeSolid: "Solid",
    solidBgColor: "Background Color",
    solidBgOpacity: "Background Opacity",
    // Visibility
    visibilitySection: "Visibility Options",
    hideWhenPaused: "Hide when paused",
    showNextTrack: "Show next track preview",
    nextTrackSeconds: "Next track display time",
    nextTrackLabel: "Next",
    seconds: "sec",
    // Element Order
    elementOrderSection: "Element Order",
    elementTrackInfo: "Track Info",
    elementOriginal: "Original",
    elementPhonetic: "Phonetic",
    elementTranslation: "Translation",
    moveUp: "↑",
    moveDown: "↓",
    // Unlock Timing
    unlockTimingSection: "Unlock",
    enableHoverUnlock: "Hover to Unlock",
    unlockWaitTime: "Wait Time",
    unlockHoldTime: "Hold Time",
    // Album Art
    albumArtSection: "Album Art",
    albumArtSize: "Size",
    albumArtBorderRadius: "Corner Radius",
    // Layout
    overlayMaxWidth: "Max Width",
    sectionGap: "Section Gap",
    noLimit: "No limit",
  },
};

function App() {
  // Check if this is the settings window
  const isSettingsWindow = window.location.search.includes("settings=true");

  const [track, setTrack] = useState<TrackInfo | null>(null);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [_isSynced, setIsSynced] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [remaining, setRemaining] = useState<number>(Infinity);
  const [nextTrack, setNextTrack] = useState<{ title: string; artist: string; albumArt?: string } | null>(null);
  const [settings, setSettings] = useState<OverlaySettings>(() => {
    const saved = localStorage.getItem("overlay-settings-v3");
    return saved
      ? { ...defaultSettings, ...JSON.parse(saved) }
      : defaultSettings;
  });

  const t = strings[settings.language || "ko"];

  const containerRef = useRef<HTMLDivElement>(null);

  // Update modal state
  type UpdateStatus =
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "upToDate"
    | "error";
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [updateVersion, setUpdateVersion] = useState("");
  const [updateError, setUpdateError] = useState("");
  const updateRef = useRef<Awaited<ReturnType<typeof check>> | null>(null);

  // Unlock interaction state
  const [unlockProgress, setUnlockProgress] = useState(0);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem("overlay-settings-v3", JSON.stringify(settings));
  }, [settings]);

  // Listen for settings changes from other windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "overlay-settings-v3" && e.newValue) {
        setSettings({ ...defaultSettings, ...JSON.parse(e.newValue) });
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
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

  // Hover state for opacity control
  const [isHovering, setIsHovering] = useState(false);

  // Listen for events from Rust backend
  useEffect(() => {
    const unlistenLyrics = listen<LyricsEvent>("lyrics-update", (event) => {
      const payload = event.payload;
      if (payload.lyricsData) {
        setTrack(payload.lyricsData.track);
        // 싱크 데이터가 없는 일반 가사는 표시하지 않음
        if (payload.lyricsData.isSynced) {
          setLyrics(payload.lyricsData.lyrics);
          setIsSynced(true);
        } else {
          setLyrics([]);
          setIsSynced(false);
        }
      }
    });

    const unlistenProgress = listen<ProgressEvent>(
      "progress-update",
      (event) => {
        const payload = event.payload;
        if (payload.progressData) {
          setProgress(payload.progressData.position);
          setIsPlaying(payload.progressData.isPlaying);
          if (payload.progressData.remaining !== undefined) {
            setRemaining(payload.progressData.remaining);
          }
          if (payload.progressData.nextTrack !== undefined) {
            setNextTrack(payload.progressData.nextTrack);
          }
        }
      }
    );

    // Listen for lock state changes from Tray
    const unlistenLockUpdate = listen<boolean>("lock-state-update", (event) => {
      setSettings((prev) => ({ ...prev, isLocked: event.payload }));
    });

    // Listen for hover state from backend (for transparency)
    const unlistenHover = listen<boolean>("overlay-hover", (event) => {
      setIsHovering(event.payload);
    });

    // Initial setup: Sync lock state with backend
    if (!isSettingsWindow) {
      // Default is locked - set both lock state and ignore cursor events
      invoke("set_lock_state", { locked: settings.isLocked }).catch(
        console.error
      );
      // IMPORTANT: Also set ignore cursor events on startup based on lock state
      invoke("set_ignore_cursor_events", { ignore: settings.isLocked }).catch(
        console.error
      );
    }

    return () => {
      unlistenLyrics.then((fn) => fn());
      unlistenProgress.then((fn) => fn());
      unlistenLockUpdate.then((fn) => fn());
      unlistenHover.then((fn) => fn());
    };
  }, []); // Run once

  // Sync lock state when settings change
  useEffect(() => {
    if (!isSettingsWindow) {
      invoke("set_lock_state", { locked: settings.isLocked }).catch(
        console.error
      );
      // IMPORTANT: Always set ignore cursor events based on lock state
      // When locked (true): ignore cursor events (click through)
      // When unlocked (false): don't ignore cursor events (catch clicks for dragging)
      invoke("set_ignore_cursor_events", { ignore: settings.isLocked }).catch(
        console.error
      );
    }
  }, [settings.isLocked, isSettingsWindow]);

  // Sync unlock timing when settings change
  useEffect(() => {
    if (!isSettingsWindow) {
      invoke("set_unlock_timing", {
        waitTime: settings.unlockWaitTime,
        holdTime: settings.unlockHoldTime
      }).catch(console.error);
    }
  }, [settings.unlockWaitTime, settings.unlockHoldTime, isSettingsWindow]);

  // Sync hover unlock enabled setting
  useEffect(() => {
    if (!isSettingsWindow) {
      invoke("set_hover_unlock_enabled", {
        enabled: settings.enableHoverUnlock
      }).catch(console.error);
    }
  }, [settings.enableHoverUnlock, isSettingsWindow]);

  // Drag functionality - only when unlocked
  const handleMouseDown = useCallback(
    async (e: React.MouseEvent) => {
      if (settings.isLocked) return;

      const target = e.target as HTMLElement;
      if (target.closest("button, input, select")) return;

      try {
        await invoke("start_drag");
      } catch (err) {
        console.error("Failed to start dragging:", err);
      }
    },
    [settings.isLocked]
  );



  // Check for updates
  const checkForAppUpdates = useCallback(async (manual = false) => {
    if (manual) {
      setUpdateStatus("checking");
      setUpdateModalOpen(true);
      setUpdateError("");
    }
    try {
      const update = await check();
      if (update?.available) {
        updateRef.current = update;
        setUpdateVersion(update.version);
        setUpdateStatus("available");
        if (!manual) setUpdateModalOpen(true); // Auto-open if update found
      } else if (manual) {
        setUpdateStatus("upToDate");
      }
    } catch (e: any) {
      console.error(e);
      const errMsg = e?.message || String(e);
      // Treat "no release" as up-to-date (common during dev)
      if (errMsg.includes("Could not fetch") || errMsg.includes("404")) {
        if (manual) {
          setUpdateError("업데이트 서버에 연결할 수 없습니다 (404)");
          setUpdateStatus("error");
        }
      } else if (manual) {
        setUpdateError(errMsg);
        setUpdateStatus("error");
      }
    }
  }, []);

  const installUpdate = useCallback(async () => {
    if (!updateRef.current) return;
    setUpdateStatus("downloading");
    try {
      await updateRef.current.downloadAndInstall();
      await relaunch();
    } catch (e: any) {
      setUpdateError(e?.message || String(e));
      setUpdateStatus("error");
    }
  }, []);

  // Auto check on mount
  useEffect(() => {
    checkForAppUpdates(false);
  }, []);

  // Get display text
  const getDisplayText = (line: LyricLine) => {
    const hasPronText = line.pronText && line.pronText.trim() !== '' && line.pronText !== line.text;
    // transText가 존재하고, 빈 문자열이 아니며, 원어/발음과 다르면 표시
    const hasTransText = line.transText &&
      line.transText.trim() !== '' &&
      line.transText !== line.text &&
      line.transText !== line.pronText;
    return {
      main: line.text || "",
      phonetic: hasPronText ? line.pronText : null,
      translation: hasTransText ? line.transText : null,
    };
  };

  // If this is the settings window, render settings UI
  if (isSettingsWindow) {
    return (
      <>
        <SettingsPanel
          settings={settings}
          onSettingsChange={setSettings}
          onCheckUpdates={() => checkForAppUpdates(true)}
        />
        {/* Update Modal */}
        {updateModalOpen && (
          <div
            className="update-modal-overlay"
            onClick={() =>
              updateStatus !== "downloading" && setUpdateModalOpen(false)
            }
          >
            <div className="update-modal" onClick={(e) => e.stopPropagation()}>
              <div className="update-modal-icon">
                {updateStatus === "checking" && (
                  <span className="spinner">⏳</span>
                )}
                {updateStatus === "available" && <span>🎉</span>}
                {updateStatus === "upToDate" && <span>✅</span>}
                {updateStatus === "downloading" && (
                  <span className="spinner">⬇️</span>
                )}
                {updateStatus === "error" && <span>❌</span>}
              </div>
              <div className="update-modal-title">
                {updateStatus === "checking" && t.checking}
                {updateStatus === "available" &&
                  t.updateAvailable.replace("{version}", updateVersion)}
                {updateStatus === "upToDate" && t.upToDate}
                {updateStatus === "downloading" && t.downloading}
                {updateStatus === "error" && t.errorParams}
              </div>
              {updateStatus === "available" && (
                <div className="update-modal-subtitle">{t.installUpdate}</div>
              )}
              {updateStatus === "error" && (
                <div className="update-modal-error">{updateError}</div>
              )}
              <div className="update-modal-actions">
                {updateStatus === "available" && (
                  <>
                    <button
                      className="update-btn cancel"
                      onClick={() => setUpdateModalOpen(false)}
                    >
                      {t.cancel}
                    </button>
                    <button
                      className="update-btn primary"
                      onClick={installUpdate}
                    >
                      {t.install}
                    </button>
                  </>
                )}
                {(updateStatus === "upToDate" || updateStatus === "error") && (
                  <button
                    className="update-btn primary"
                    onClick={() => setUpdateModalOpen(false)}
                  >
                    {t.close}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Convert hex to rgba
  const hexToRgba = (hex: string, opacity: number) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      return `rgba(${parseInt(result[1], 16)}, ${parseInt(
        result[2],
        16
      )}, ${parseInt(result[3], 16)}, ${opacity})`;
    }
    return hex;
  };

  const display = activeLine ? getDisplayText(activeLine) : null;

  // Alignment classes
  const alignClass =
    settings.textAlign === "left"
      ? "align-left"
      : settings.textAlign === "right"
        ? "align-right"
        : "align-center";

  // Listen for unlock progress from backend
  useEffect(() => {
    const unlistenUnlockProgress = listen<number>(
      "unlock-progress",
      (event) => {
        setUnlockProgress(event.payload);
      }
    );

    return () => {
      unlistenUnlockProgress.then((fn) => fn());
    };
  }, []);

  // Calculate visibility
  const shouldHide = settings.hideWhenPaused && !isPlaying && track !== null;
  const calculatedOpacity = shouldHide ? 0 : (isHovering && settings.isLocked ? 0.2 : 1);

  // Determine if we should show next track info instead of current track
  const showNextTrackInfo = settings.showNextTrack && nextTrack && remaining <= settings.nextTrackSeconds && remaining > 0;

  return (
    <div
      ref={containerRef}
      className={`overlay-container ${!isPlaying ? "paused" : ""
        } ${alignClass} ${settings.isLocked ? "locked" : "unlocked"}`}
      onMouseDown={handleMouseDown}
      style={
        {
          opacity: calculatedOpacity,
          transition: "opacity 0.3s ease", // Smooth transition
          background:
            settings.backgroundMode === "solid"
              ? hexToRgba(
                settings.solidBackgroundColor,
                settings.solidBackgroundOpacity / 100
              )
              : "transparent",
          "--original-size": `${settings.originalFontSize}px`,
          "--phonetic-size": `${settings.phoneticFontSize}px`,
          "--translation-size": `${settings.translationFontSize}px`,
          "--original-weight": settings.originalFontWeight,
          "--phonetic-weight": settings.phoneticFontWeight,
          "--translation-weight": settings.translationFontWeight,
          "--text-color": settings.textColor,
          "--active-color": settings.activeColor,
          "--phonetic-color": settings.phoneticColor,
          "--translation-color": settings.translationColor,
          "--line-bg": hexToRgba(
            settings.backgroundColor,
            settings.lineBackgroundOpacity / 100
          ),
          "--track-info-size": `${settings.trackInfoFontSize}px`,
          "--track-info-weight": settings.trackInfoFontWeight,
          "--track-info-color": settings.trackInfoColor,
          "--track-info-bg": hexToRgba(
            settings.trackInfoBgColor,
            settings.trackInfoBgOpacity / 100
          ),
          "--track-info-radius": `${settings.trackInfoBorderRadius}px`,
          "--border-radius": `${settings.borderRadius}px`,
          "--padding": `${settings.padding}px`,
          "--line-gap": `${settings.lineGap}px`,
          "--anim-duration": `${settings.animationDuration}ms`,
          "--text-shadow":
            settings.textShadow === "soft"
              ? "0 2px 4px rgba(0,0,0,0.5)"
              : settings.textShadow === "hard"
                ? "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000"
                : "none",
          "--text-stroke": settings.textStroke
            ? `${settings.textStrokeSize}px black`
            : "none",
          "--text-stroke-mode":
            settings.textStrokeMode === "inner" ? "fill stroke" : "stroke fill",
          "--original-font": settings.originalFontFamily || "inherit",
          "--phonetic-font": settings.phoneticFontFamily || "inherit",
          "--translation-font": settings.translationFontFamily || "inherit",
          "--section-gap": `${settings.sectionGap}px`,
          maxWidth: settings.overlayMaxWidth > 0 ? `${settings.overlayMaxWidth}px` : "none",
        } as React.CSSProperties
      }
    >

      {/* Global Unlock Progress Gauge (Centered) */}
      {settings.isLocked && unlockProgress > 0 && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "60px",
              height: "60px",
            }}
          >
            <svg
              width="60"
              height="60"
              viewBox="0 0 60 60"
              style={{ transform: "rotate(-90deg)" }}
            >
              <circle
                cx="30"
                cy="30"
                r="26"
                stroke="rgba(0,0,0,0.5)"
                strokeWidth="6"
                fill="rgba(0,0,0,0.3)"
              />
              <circle
                cx="30"
                cy="30"
                r="26"
                stroke={settings.activeColor}
                strokeWidth="6"
                fill="transparent"
                strokeDasharray={`${2 * Math.PI * 26}`}
                strokeDashoffset={`${2 * Math.PI * 26 * (1 - unlockProgress / 100)
                  }`}
                strokeLinecap="round"
                style={{
                  transition: "stroke-dashoffset 0.1s linear",
                }}
              />
            </svg>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
              }}
            >
              🔓
            </div>
          </div>
          <div
            style={{
              color: "white",
              fontSize: "12px",
              textShadow: "0 2px 4px black",
              background: "rgba(0,0,0,0.5)",
              padding: "4px 8px",
              borderRadius: "4px",
              whiteSpace: "nowrap",
            }}
          >
            {t.holdToUnlock}
          </div>
        </div>
      )}



      {/* Render elements based on elementOrder */}
      {(() => {
        // Find trackInfo position in order
        const trackInfoIndex = settings.elementOrder.indexOf("trackInfo");
        const lyricsElements = settings.elementOrder.filter(e => e !== "trackInfo");

        // Render track info at its position, and lyrics box content in order
        const renderTrackInfo = () => {
          if (!settings.showTrackInfo || (!track && !(settings.showNextTrack && nextTrack))) {
            return null;
          }
          return (
            <div
              key="trackInfo"
              className="track-info-line"
              style={{ animation: "fadeIn 0.4s ease" }}
            >
              {showNextTrackInfo && nextTrack ? (
                <>
                  {nextTrack.albumArt && (
                    <img
                      src={nextTrack.albumArt}
                      alt=""
                      className="album-art"
                      style={{
                        width: `${settings.albumArtSize}px`,
                        height: `${settings.albumArtSize}px`,
                        borderRadius: `${settings.albumArtBorderRadius}px`,
                      }}
                    />
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: 0, flex: 1 }}>
                    <span style={{
                      fontSize: "10px",
                      color: "rgba(255,255,255,0.5)",
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px"
                    }}>
                      {t.nextTrackLabel}
                    </span>
                    <span className="track-text" style={{ marginTop: "1px" }}>
                      {nextTrack.artist} - {nextTrack.title}
                    </span>
                  </div>
                </>
              ) : track ? (
                <>
                  {track.albumArt && (
                    <img
                      src={track.albumArt}
                      alt=""
                      className="album-art"
                      style={{
                        width: `${settings.albumArtSize}px`,
                        height: `${settings.albumArtSize}px`,
                        borderRadius: `${settings.albumArtBorderRadius}px`,
                      }}
                    />
                  )}
                  <span className="track-text">
                    {track.artist} - {track.title}
                  </span>
                </>
              ) : null}
            </div>
          );
        };

        const renderLyricsBox = () => {
          if (!display) return null;

          // Render lyrics elements in order
          const lyricsContent = lyricsElements.map(element => {
            switch (element) {
              case "original":
                if (!settings.showOriginal || !display.main) return null;
                return <div key="original" className="lyric-line original">{display.main}</div>;
              case "phonetic":
                if (!settings.showPhonetic || !display.phonetic) return null;
                return <div key="phonetic" className="lyric-line phonetic">{display.phonetic}</div>;
              case "translation":
                if (!settings.showTranslation || !display.translation) return null;
                return <div key="translation" className="lyric-line translation">{display.translation}</div>;
              default:
                return null;
            }
          }).filter(Boolean);

          if (lyricsContent.length === 0) return null;

          return (
            <div
              key={activeLine?.startTime || "empty"}
              className={`lyrics-box anim-${settings.animationType}`}
            >
              {lyricsContent}
            </div>
          );
        };

        // Determine render order: trackInfo before or after lyrics
        if (trackInfoIndex === 0) {
          return (
            <>
              {renderTrackInfo()}
              {renderLyricsBox()}
            </>
          );
        } else {
          return (
            <>
              {renderLyricsBox()}
              {renderTrackInfo()}
            </>
          );
        }
      })()}

      {/* Waiting Indicator */}
      {!display && !track && !settings.isLocked && (
        <div className="waiting-indicator">
          <div className="waiting-dot"></div>
          <span>{t.waiting}</span>
        </div>
      )}
    </div>
  );
}

// Custom Font Picker Component
function FontPicker({
  fonts,
  value,
  onChange,
  placeholder,
}: {
  fonts: string[];
  value: string;
  onChange: (font: string) => void;
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredFonts = useMemo(() => {
    if (!search) return fonts.slice(0, 100); // Limit for performance
    return fonts
      .filter((f) => f.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 50);
  }, [fonts, search]);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  return (
    <div className="font-picker" ref={containerRef}>
      <button
        className="font-picker-trigger"
        onClick={() => setIsOpen(!isOpen)}
        style={{ fontFamily: value || "inherit" }}
      >
        <span className="font-picker-value">{value || placeholder}</span>
        <span className="font-picker-arrow">▾</span>
      </button>
      {isOpen && (
        <div className="font-picker-dropdown">
          <input
            type="text"
            className="font-picker-search"
            placeholder="Search fonts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="font-picker-list">
            <div
              className={`font-picker-item ${!value ? "selected" : ""}`}
              onClick={() => {
                onChange("");
                setIsOpen(false);
                setSearch("");
              }}
            >
              {placeholder}
            </div>
            {filteredFonts.map((font) => (
              <div
                key={font}
                className={`font-picker-item ${value === font ? "selected" : ""
                  }`}
                style={{ fontFamily: font }}
                onClick={() => {
                  onChange(font);
                  setIsOpen(false);
                  setSearch("");
                }}
              >
                {font}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Settings Panel Component
function SettingsPanel({
  settings,
  onSettingsChange,
  onCheckUpdates,
}: {
  settings: OverlaySettings;
  onSettingsChange: (s: OverlaySettings) => void;
  onCheckUpdates: () => void;
}) {
  const t = strings[settings.language || "ko"];
  const [autoStart, setAutoStart] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [systemFonts, setSystemFonts] = useState<string[]>([]);

  useEffect(() => {
    isEnabled()
      .then(setAutoStart)
      .catch((e) => console.error("Failed to check autostart:", e));
    // Load system fonts
    invoke<string[]>("get_system_fonts")
      .then((fonts) => setSystemFonts(fonts))
      .catch((e) => console.error("Failed to load fonts:", e));
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

  const updateSetting = <K extends keyof OverlaySettings>(
    key: K,
    value: OverlaySettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const toggleLanguage = () => {
    updateSetting("language", settings.language === "en" ? "ko" : "en");
  };

  return (
    <div
      className={`settings-panel ios-style ${!settings.isLocked ? "open" : ""}`}
    >
      <div className="settings-header">
        <h2>{t.settingsTitle}</h2>
        <button className="lang-toggle-btn" onClick={toggleLanguage}>
          {settings.language === "en" ? "US" : "KO"}
        </button>
      </div>

      {/* Tab Navigation */}
      <div
        className="ios-segmented-control"
        style={{ margin: "0 20px 16px", width: "auto" }}
      >
        {(["general", "display", "style", "animation"] as SettingsTab[]).map(
          (tab) => (
            <button
              key={tab}
              className={activeTab === tab ? "active" : ""}
              onClick={() => setActiveTab(tab)}
              style={{ padding: "6px 0", fontSize: "13px" }}
            >
              {tab === "general"
                ? t.tabGeneral
                : tab === "display"
                  ? t.tabDisplay
                  : tab === "style"
                    ? t.tabStyle
                    : t.tabAnim}
            </button>
          )
        )}
      </div>

      <div className="settings-content">
        {/* ================= GENERAL TAB ================= */}
        {activeTab === "general" && (
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
                    if (confirm(t.resetConfirm))
                      onSettingsChange({
                        ...defaultSettings,
                        language: settings.language,
                      });
                  }}
                >
                  {t.reset}
                </button>
              </div>

              <div className="ios-item column">
                <button
                  className="ios-button"
                  style={{
                    background: "#1c1c1e",
                    color: "#0a84ff",
                    fontWeight: 600,
                  }}
                  onClick={onCheckUpdates}
                >
                  {t.checkForUpdates}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ================= DISPLAY TAB ================= */}
        {activeTab === "display" && (
          <>
            <section className="ios-section">
              <div className="section-header">{t.showSection}</div>
              <div className="ios-list">
                <label className="ios-item">
                  <span>{t.originalLyrics}</span>
                  <div className="toggle-wrapper">
                    <input
                      type="checkbox"
                      checked={settings.showOriginal}
                      onChange={(e) =>
                        updateSetting("showOriginal", e.target.checked)
                      }
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
                <label className="ios-item">
                  <span>{t.phoneticLyrics}</span>
                  <div className="toggle-wrapper">
                    <input
                      type="checkbox"
                      checked={settings.showPhonetic}
                      onChange={(e) =>
                        updateSetting("showPhonetic", e.target.checked)
                      }
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
                <label className="ios-item">
                  <span>{t.translationLyrics}</span>
                  <div className="toggle-wrapper">
                    <input
                      type="checkbox"
                      checked={settings.showTranslation}
                      onChange={(e) =>
                        updateSetting("showTranslation", e.target.checked)
                      }
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
                <label className="ios-item">
                  <span>{t.trackInfo}</span>
                  <div className="toggle-wrapper">
                    <input
                      type="checkbox"
                      checked={settings.showTrackInfo}
                      onChange={(e) =>
                        updateSetting("showTrackInfo", e.target.checked)
                      }
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
              </div>
            </section>

            {/* Background Mode Section */}
            <section className="ios-section">
              <div className="section-header">{t.backgroundModeSection}</div>
              <div className="ios-list">
                <div className="ios-item column">
                  <div className="item-row">
                    <span>{t.backgroundModeSection}</span>
                  </div>
                  <div className="ios-segmented-control">
                    <button
                      className={settings.backgroundMode === "transparent" ? "active" : ""}
                      onClick={() => updateSetting("backgroundMode", "transparent")}
                    >
                      {t.bgModeTransparent}
                    </button>
                    <button
                      className={settings.backgroundMode === "solid" ? "active" : ""}
                      onClick={() => updateSetting("backgroundMode", "solid")}
                    >
                      {t.bgModeSolid}
                    </button>
                  </div>
                </div>
                {settings.backgroundMode === "solid" && (
                  <>
                    <div className="ios-item">
                      <span>{t.solidBgColor}</span>
                      <div className="color-wrapper">
                        <input
                          type="color"
                          value={settings.solidBackgroundColor}
                          onChange={(e) =>
                            updateSetting("solidBackgroundColor", e.target.value)
                          }
                        />
                        <div
                          className="color-preview"
                          style={{ background: settings.solidBackgroundColor }}
                        ></div>
                      </div>
                    </div>
                    <div className="ios-item column">
                      <div className="item-row">
                        <span>{t.solidBgOpacity}</span>
                        <span className="value-text">
                          {settings.solidBackgroundOpacity}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={settings.solidBackgroundOpacity}
                        onChange={(e) =>
                          updateSetting(
                            "solidBackgroundOpacity",
                            parseInt(e.target.value)
                          )
                        }
                      />
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* Visibility Options Section */}
            <section className="ios-section">
              <div className="section-header">{t.visibilitySection}</div>
              <div className="ios-list">
                <label className="ios-item">
                  <span>{t.hideWhenPaused}</span>
                  <div className="toggle-wrapper">
                    <input
                      type="checkbox"
                      checked={settings.hideWhenPaused}
                      onChange={(e) =>
                        updateSetting("hideWhenPaused", e.target.checked)
                      }
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
                <label className="ios-item">
                  <span>{t.showNextTrack}</span>
                  <div className="toggle-wrapper">
                    <input
                      type="checkbox"
                      checked={settings.showNextTrack}
                      onChange={(e) =>
                        updateSetting("showNextTrack", e.target.checked)
                      }
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
                {settings.showNextTrack && (
                  <div className="ios-item column">
                    <div className="item-row">
                      <span>{t.nextTrackSeconds}</span>
                      <span className="value-text">
                        {settings.nextTrackSeconds}{t.seconds}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="30"
                      value={settings.nextTrackSeconds}
                      onChange={(e) =>
                        updateSetting(
                          "nextTrackSeconds",
                          parseInt(e.target.value)
                        )
                      }
                    />
                  </div>
                )}
              </div>
            </section>

            {/* Element Order Section */}
            <section className="ios-section">
              <div className="section-header">{t.elementOrderSection}</div>
              <div className="ios-list">
                {settings.elementOrder.map((element, index) => {
                  const elementLabels: Record<string, string> = {
                    trackInfo: t.elementTrackInfo,
                    original: t.elementOriginal,
                    phonetic: t.elementPhonetic,
                    translation: t.elementTranslation,
                  };

                  const moveUp = () => {
                    if (index === 0) return;
                    const newOrder = [...settings.elementOrder];
                    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
                    updateSetting("elementOrder", newOrder);
                  };

                  const moveDown = () => {
                    if (index === settings.elementOrder.length - 1) return;
                    const newOrder = [...settings.elementOrder];
                    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                    updateSetting("elementOrder", newOrder);
                  };

                  return (
                    <div key={element} className="ios-item" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ flex: 1 }}>{elementLabels[element] || element}</span>
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button
                          onClick={moveUp}
                          disabled={index === 0}
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "6px",
                            border: "none",
                            background: index === 0 ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.2)",
                            color: index === 0 ? "rgba(255,255,255,0.3)" : "#fff",
                            cursor: index === 0 ? "not-allowed" : "pointer",
                            fontSize: "14px",
                            pointerEvents: "auto",
                          }}
                        >
                          {t.moveUp}
                        </button>
                        <button
                          onClick={moveDown}
                          disabled={index === settings.elementOrder.length - 1}
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "6px",
                            border: "none",
                            background: index === settings.elementOrder.length - 1 ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.2)",
                            color: index === settings.elementOrder.length - 1 ? "rgba(255,255,255,0.3)" : "#fff",
                            cursor: index === settings.elementOrder.length - 1 ? "not-allowed" : "pointer",
                            fontSize: "14px",
                            pointerEvents: "auto",
                          }}
                        >
                          {t.moveDown}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>


            {/* Unlock Timing Section */}
            <section className="ios-section">
              <div className="section-header">{t.unlockTimingSection}</div>
              <div className="ios-list">
                {/* Enable Hover Unlock Toggle */}
                <div className="ios-item">
                  <span>{t.enableHoverUnlock}</span>
                  <label className="toggle-wrapper">
                    <input
                      type="checkbox"
                      checked={settings.enableHoverUnlock}
                      onChange={(e) => updateSetting("enableHoverUnlock", e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
                {/* Wait/Hold time sliders - only show when enabled */}
                {settings.enableHoverUnlock && (
                  <>
                    <div className="ios-item column">
                      <div className="item-row">
                        <span>{t.unlockWaitTime}</span>
                        <span className="value-text">{settings.unlockWaitTime.toFixed(1)}{t.seconds}</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="3"
                        step="0.1"
                        value={settings.unlockWaitTime}
                        onChange={(e) => updateSetting("unlockWaitTime", parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="ios-item column">
                      <div className="item-row">
                        <span>{t.unlockHoldTime}</span>
                        <span className="value-text">{settings.unlockHoldTime.toFixed(1)}{t.seconds}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        step="0.5"
                        value={settings.unlockHoldTime}
                        onChange={(e) => updateSetting("unlockHoldTime", parseFloat(e.target.value))}
                      />
                    </div>
                  </>
                )}
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
                    <button
                      className={settings.textAlign === "left" ? "active" : ""}
                      onClick={() => updateSetting("textAlign", "left")}
                    >
                      {t.alignLeft}
                    </button>
                    <button
                      className={
                        settings.textAlign === "center" ? "active" : ""
                      }
                      onClick={() => updateSetting("textAlign", "center")}
                    >
                      {t.alignCenter}
                    </button>
                    <button
                      className={settings.textAlign === "right" ? "active" : ""}
                      onClick={() => updateSetting("textAlign", "right")}
                    >
                      {t.alignRight}
                    </button>
                  </div>
                </div>
                {/* Line Gap */}
                <div className="ios-item column">
                  <div className="item-row">
                    <span>{t.lineGap}</span>
                    <span className="value-text">{settings.lineGap}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    value={settings.lineGap}
                    onChange={(e) =>
                      updateSetting("lineGap", parseInt(e.target.value))
                    }
                  />
                </div>
                {/* Section Gap */}
                <div className="ios-item column">
                  <div className="item-row">
                    <span>{t.sectionGap}</span>
                    <span className="value-text">{settings.sectionGap}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="24"
                    value={settings.sectionGap}
                    onChange={(e) =>
                      updateSetting("sectionGap", parseInt(e.target.value))
                    }
                  />
                </div>
                {/* Max Width */}
                <div className="ios-item column">
                  <div className="item-row">
                    <span>{t.overlayMaxWidth}</span>
                    <span className="value-text">
                      {settings.overlayMaxWidth === 0 ? t.noLimit : `${settings.overlayMaxWidth}px`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1200"
                    step="50"
                    value={settings.overlayMaxWidth}
                    onChange={(e) =>
                      updateSetting("overlayMaxWidth", parseInt(e.target.value))
                    }
                  />
                </div>
              </div>
            </section>

            {/* Album Art Section */}
            <section className="ios-section">
              <div className="section-header">{t.albumArtSection}</div>
              <div className="ios-list">
                {/* Album Art Size */}
                <div className="ios-item column">
                  <div className="item-row">
                    <span>{t.albumArtSize}</span>
                    <span className="value-text">{settings.albumArtSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="24"
                    max="64"
                    value={settings.albumArtSize}
                    onChange={(e) =>
                      updateSetting("albumArtSize", parseInt(e.target.value))
                    }
                  />
                </div>
                {/* Album Art Border Radius */}
                <div className="ios-item column">
                  <div className="item-row">
                    <span>{t.albumArtBorderRadius}</span>
                    <span className="value-text">{settings.albumArtBorderRadius}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="32"
                    value={settings.albumArtBorderRadius}
                    onChange={(e) =>
                      updateSetting("albumArtBorderRadius", parseInt(e.target.value))
                    }
                  />
                </div>
              </div>
            </section>
          </>
        )}

        {/* ================= STYLE TAB ================= */}
        {activeTab === "style" && (
          <>
            {/* Typography */}
            <section className="ios-section">
              <div className="section-header">{t.typoSection}</div>
              <div className="ios-list">
                {/* Original */}
                <div className="ios-item column">
                  <div className="item-row">
                    <span>{t.originalStyle}</span>
                    <span className="value-text">
                      {settings.originalFontSize}px /{" "}
                      {settings.originalFontWeight}
                    </span>
                  </div>
                  <div className="slider-group">
                    <input
                      type="range"
                      min="12"
                      max="64"
                      value={settings.originalFontSize}
                      onChange={(e) =>
                        updateSetting(
                          "originalFontSize",
                          parseInt(e.target.value)
                        )
                      }
                    />
                    <select
                      className="ios-select"
                      value={settings.originalFontWeight}
                      onChange={(e) =>
                        updateSetting("originalFontWeight", e.target.value)
                      }
                    >
                      <option value="300">Light</option>
                      <option value="400">Regular</option>
                      <option value="700">Bold</option>
                      <option value="900">Heavy</option>
                    </select>
                  </div>
                  <div className="item-row" style={{ marginTop: 8 }}>
                    <span>{t.fontFamily}</span>
                  </div>
                  <FontPicker
                    fonts={systemFonts}
                    value={settings.originalFontFamily}
                    onChange={(f) => updateSetting("originalFontFamily", f)}
                    placeholder={t.systemDefault}
                  />
                </div>
                {/* Phonetic */}
                <div className="ios-item column">
                  <div className="item-row">
                    <span>{t.phoneticStyle}</span>
                    <span className="value-text">
                      {settings.phoneticFontSize}px /{" "}
                      {settings.phoneticFontWeight}
                    </span>
                  </div>
                  <div className="slider-group">
                    <input
                      type="range"
                      min="10"
                      max="40"
                      value={settings.phoneticFontSize}
                      onChange={(e) =>
                        updateSetting(
                          "phoneticFontSize",
                          parseInt(e.target.value)
                        )
                      }
                    />
                    <select
                      className="ios-select"
                      value={settings.phoneticFontWeight}
                      onChange={(e) =>
                        updateSetting("phoneticFontWeight", e.target.value)
                      }
                    >
                      <option value="300">Light</option>
                      <option value="400">Regular</option>
                      <option value="500">Medium</option>
                      <option value="700">Bold</option>
                    </select>
                  </div>
                  <div className="item-row" style={{ marginTop: 8 }}>
                    <span>{t.fontFamily}</span>
                  </div>
                  <FontPicker
                    fonts={systemFonts}
                    value={settings.phoneticFontFamily}
                    onChange={(f) => updateSetting("phoneticFontFamily", f)}
                    placeholder={t.systemDefault}
                  />
                </div>
                {/* Translation */}
                <div className="ios-item column">
                  <div className="item-row">
                    <span>{t.transStyle}</span>
                    <span className="value-text">
                      {settings.translationFontSize}px /{" "}
                      {settings.translationFontWeight}
                    </span>
                  </div>
                  <div className="slider-group">
                    <input
                      type="range"
                      min="10"
                      max="40"
                      value={settings.translationFontSize}
                      onChange={(e) =>
                        updateSetting(
                          "translationFontSize",
                          parseInt(e.target.value)
                        )
                      }
                    />
                    <select
                      className="ios-select"
                      value={settings.translationFontWeight}
                      onChange={(e) =>
                        updateSetting("translationFontWeight", e.target.value)
                      }
                    >
                      <option value="300">Light</option>
                      <option value="400">Regular</option>
                      <option value="500">Medium</option>
                      <option value="700">Bold</option>
                    </select>
                  </div>
                  <div className="item-row" style={{ marginTop: 8 }}>
                    <span>{t.fontFamily}</span>
                  </div>
                  <FontPicker
                    fonts={systemFonts}
                    value={settings.translationFontFamily}
                    onChange={(f) => updateSetting("translationFontFamily", f)}
                    placeholder={t.systemDefault}
                  />
                </div>
                {/* Song Info (곡 정보) */}
                <div className="ios-item column">
                  <div className="item-row">
                    <span>{t.songInfoSection}</span>
                    <span className="value-text">
                      {settings.trackInfoFontSize}px
                    </span>
                  </div>
                  <div className="slider-group">
                    <input
                      type="range"
                      min="10"
                      max="32"
                      value={settings.trackInfoFontSize}
                      onChange={(e) =>
                        updateSetting(
                          "trackInfoFontSize",
                          parseInt(e.target.value)
                        )
                      }
                    />
                    <select
                      className="ios-select"
                      value={settings.trackInfoFontWeight}
                      onChange={(e) =>
                        updateSetting("trackInfoFontWeight", e.target.value)
                      }
                    >
                      <option value="400">Regular</option>
                      <option value="600">Semi-Bold</option>
                      <option value="700">Bold</option>
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
                    <input
                      type="checkbox"
                      checked={settings.textStroke}
                      onChange={(e) =>
                        updateSetting("textStroke", e.target.checked)
                      }
                    />
                    <span className="toggle-slider"></span>
                  </div>
                </label>
                {settings.textStroke && (
                  <>
                    <div className="ios-item column">
                      <div className="item-row">
                        <span>{t.strokeSize}</span>
                        <span className="value-text">
                          {settings.textStrokeSize}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={settings.textStrokeSize}
                        onChange={(e) =>
                          updateSetting(
                            "textStrokeSize",
                            parseInt(e.target.value)
                          )
                        }
                      />
                    </div>
                    <div className="ios-item column">
                      <div className="item-row">
                        <span>{t.strokeMode}</span>
                      </div>
                      <div className="ios-segmented-control">
                        <button
                          className={
                            settings.textStrokeMode === "outer" ? "active" : ""
                          }
                          onClick={() =>
                            updateSetting("textStrokeMode", "outer")
                          }
                        >
                          {t.strokeOuter}
                        </button>
                        <button
                          className={
                            settings.textStrokeMode === "inner" ? "active" : ""
                          }
                          onClick={() =>
                            updateSetting("textStrokeMode", "inner")
                          }
                        >
                          {t.strokeInner}
                        </button>
                      </div>
                    </div>
                  </>
                )}
                <div className="ios-item column">
                  <div className="item-row">
                    <span>{t.textShadow}</span>
                  </div>
                  <div className="ios-segmented-control">
                    <button
                      className={settings.textShadow === "none" ? "active" : ""}
                      onClick={() => updateSetting("textShadow", "none")}
                    >
                      {t.shadowNone}
                    </button>
                    <button
                      className={settings.textShadow === "soft" ? "active" : ""}
                      onClick={() => updateSetting("textShadow", "soft")}
                    >
                      {t.shadowSoft}
                    </button>
                    <button
                      className={settings.textShadow === "hard" ? "active" : ""}
                      onClick={() => updateSetting("textShadow", "hard")}
                    >
                      {t.shadowHard}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Song Info Styling */}
            <section className="ios-section">
              <div className="section-header">{t.songInfoSection}</div>
              <div className="ios-list">
                <div className="ios-item">
                  <span>{t.songInfoColor}</span>
                  <div className="color-wrapper">
                    <input
                      type="color"
                      value={settings.trackInfoColor}
                      onChange={(e) =>
                        updateSetting("trackInfoColor", e.target.value)
                      }
                    />
                    <div
                      className="color-preview"
                      style={{ background: settings.trackInfoColor }}
                    ></div>
                  </div>
                </div>
                <div className="ios-item">
                  <span>{t.songInfoBgColor}</span>
                  <div className="color-wrapper">
                    <input
                      type="color"
                      value={settings.trackInfoBgColor}
                      onChange={(e) =>
                        updateSetting("trackInfoBgColor", e.target.value)
                      }
                    />
                    <div
                      className="color-preview"
                      style={{ background: settings.trackInfoBgColor }}
                    ></div>
                  </div>
                </div>
                <div className="ios-item column">
                  <div className="item-row">
                    <span>{t.songInfoBg}</span>
                    <span className="value-text">
                      {settings.trackInfoBgOpacity}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.trackInfoBgOpacity}
                    onChange={(e) =>
                      updateSetting(
                        "trackInfoBgOpacity",
                        parseInt(e.target.value)
                      )
                    }
                  />
                </div>
                <div className="ios-item column">
                  <div className="item-row">
                    <span>{t.songInfoRadius}</span>
                    <span className="value-text">
                      {settings.trackInfoBorderRadius}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    value={settings.trackInfoBorderRadius}
                    onChange={(e) =>
                      updateSetting(
                        "trackInfoBorderRadius",
                        parseInt(e.target.value)
                      )
                    }
                  />
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
                    <input
                      type="color"
                      value={settings.activeColor}
                      onChange={(e) =>
                        updateSetting("activeColor", e.target.value)
                      }
                    />
                    <div
                      className="color-preview"
                      style={{ background: settings.activeColor }}
                    ></div>
                  </div>
                </div>
                <div className="ios-item">
                  <span>{t.phoneticColor}</span>
                  <div className="color-wrapper">
                    <input
                      type="color"
                      value={settings.phoneticColor}
                      onChange={(e) =>
                        updateSetting("phoneticColor", e.target.value)
                      }
                    />
                    <div
                      className="color-preview"
                      style={{ background: settings.phoneticColor }}
                    ></div>
                  </div>
                </div>
                <div className="ios-item">
                  <span>{t.transColor}</span>
                  <div className="color-wrapper">
                    <input
                      type="color"
                      value={settings.translationColor}
                      onChange={(e) =>
                        updateSetting("translationColor", e.target.value)
                      }
                    />
                    <div
                      className="color-preview"
                      style={{ background: settings.translationColor }}
                    ></div>
                  </div>
                </div>
                <div className="ios-item">
                  <span>{t.bgColor}</span>
                  <div className="color-wrapper">
                    <input
                      type="color"
                      value={settings.backgroundColor}
                      onChange={(e) =>
                        updateSetting("backgroundColor", e.target.value)
                      }
                    />
                    <div
                      className="color-preview"
                      style={{ background: settings.backgroundColor }}
                    ></div>
                  </div>
                </div>
                <div className="ios-item column">
                  <div className="item-row">
                    <span>{t.bgOpacity}</span>
                    <span className="value-text">
                      {settings.lineBackgroundOpacity}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.lineBackgroundOpacity}
                    onChange={(e) =>
                      updateSetting(
                        "lineBackgroundOpacity",
                        parseInt(e.target.value)
                      )
                    }
                  />
                </div>
                <div className="ios-item column">
                  <div className="item-row">
                    <span>{t.radius}</span>
                    <span className="value-text">
                      {settings.borderRadius}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    value={settings.borderRadius}
                    onChange={(e) =>
                      updateSetting("borderRadius", parseInt(e.target.value))
                    }
                  />
                </div>
              </div>
            </section>
          </>
        )}

        {/* ================= ANIMATION TAB ================= */}
        {activeTab === "animation" && (
          <section className="ios-section">
            <div className="section-header">{t.animSection}</div>
            <div className="ios-list">
              <div className="ios-item column">
                <div className="item-row">
                  <span>{t.animType}</span>
                </div>
                <div className="ios-segmented-control">
                  {(["fade", "slide", "scale", "none"] as const).map((type) => (
                    <button
                      key={type}
                      className={
                        settings.animationType === type ? "active" : ""
                      }
                      onClick={() => updateSetting("animationType", type)}
                    >
                      {
                        t[
                        ("anim" +
                          type.charAt(0).toUpperCase() +
                          type.slice(1)) as keyof typeof t
                        ]
                      }
                    </button>
                  ))}
                </div>
              </div>

              {settings.animationType !== "none" && (
                <div className="ios-item column">
                  <div className="item-row">
                    <span>{t.animDuration}</span>
                    <span className="value-text">
                      {settings.animationDuration}ms
                    </span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="1000"
                    step="50"
                    value={settings.animationDuration}
                    onChange={(e) =>
                      updateSetting(
                        "animationDuration",
                        parseInt(e.target.value)
                      )
                    }
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
