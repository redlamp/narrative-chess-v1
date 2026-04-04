import type { AppSettings } from "../appSettings";

type AppMenuProps = {
  isOpen: boolean;
  isLayoutMode: boolean;
  settings: AppSettings;
  isCompactViewport: boolean;
  onToggleOpen: () => void;
  onToggleLayoutMode: () => void;
  onResetLayout: () => void;
  onExpandPanels: () => void;
  onResetSettings: () => void;
  onDefaultViewModeChange: (value: "board" | "map") => void;
  onBooleanSettingChange: (
    key:
      | "showBoardCoordinates"
      | "showDistrictLabels"
      | "showRecentCharacterActions"
      | "showLayoutGrid",
    value: boolean
  ) => void;
};

type SettingsToggleRowProps = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function SettingsToggleRow({
  label,
  description,
  checked,
  onChange
}: SettingsToggleRowProps) {
  return (
    <label className="menu-toggle">
      <div>
        <span className="menu-toggle__label">{label}</span>
        <span className="menu-toggle__description">{description}</span>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    </label>
  );
}

export function AppMenu({
  isOpen,
  isLayoutMode,
  settings,
  isCompactViewport,
  onToggleOpen,
  onToggleLayoutMode,
  onResetLayout,
  onExpandPanels,
  onResetSettings,
  onDefaultViewModeChange,
  onBooleanSettingChange
}: AppMenuProps) {
  return (
    <div className="app-menu">
      <button
        type="button"
        className={`button button--ghost ${isOpen ? "button--active" : ""}`}
        onClick={onToggleOpen}
        aria-expanded={isOpen}
      >
        Menu
      </button>

      {isOpen ? (
        <div className="app-menu__panel">
          <section className="app-menu__section">
            <div className="app-menu__section-header">
              <p className="panel__eyebrow">Workspace</p>
              <p className="muted">Controls for editing the match layout.</p>
            </div>
            <div className="app-menu__actions">
              <button
                type="button"
                className={`button button--ghost ${isLayoutMode ? "button--active" : ""}`}
                onClick={onToggleLayoutMode}
                disabled={isCompactViewport}
              >
                {isLayoutMode ? "Exit layout mode" : "Enter layout mode"}
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={onExpandPanels}
              >
                Expand all panels
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={onResetLayout}
              >
                Reset layout
              </button>
            </div>
            {isCompactViewport ? (
              <p className="muted">
                Layout editing is available on wider screens so the snap grid stays usable.
              </p>
            ) : null}
          </section>

          <section className="app-menu__section">
            <div className="app-menu__section-header">
              <p className="panel__eyebrow">Settings</p>
              <p className="muted">First-pass display and interaction preferences.</p>
            </div>

            <div className="menu-segment">
              <span className="menu-segment__label">Default board view</span>
              <div className="page-switcher">
                <button
                  type="button"
                  className={`button button--ghost ${settings.defaultViewMode === "board" ? "button--active" : ""}`}
                  onClick={() => onDefaultViewModeChange("board")}
                >
                  Board
                </button>
                <button
                  type="button"
                  className={`button button--ghost ${settings.defaultViewMode === "map" ? "button--active" : ""}`}
                  onClick={() => onDefaultViewModeChange("map")}
                >
                  Map
                </button>
              </div>
            </div>

            <div className="app-menu__toggles">
              <SettingsToggleRow
                label="Board coordinates"
                description="Keep file and rank markers visible on the board."
                checked={settings.showBoardCoordinates}
                onChange={(checked) => onBooleanSettingChange("showBoardCoordinates", checked)}
              />
              <SettingsToggleRow
                label="District labels"
                description="Show city-district names directly on the tiles."
                checked={settings.showDistrictLabels}
                onChange={(checked) => onBooleanSettingChange("showDistrictLabels", checked)}
              />
              <SettingsToggleRow
                label="Recent actions"
                description="Show recent character moments inside the hover panel."
                checked={settings.showRecentCharacterActions}
                onChange={(checked) => onBooleanSettingChange("showRecentCharacterActions", checked)}
              />
              <SettingsToggleRow
                label="Layout grid"
                description="Show the snap grid while layout mode is active."
                checked={settings.showLayoutGrid}
                onChange={(checked) => onBooleanSettingChange("showLayoutGrid", checked)}
              />
            </div>

            <div className="app-menu__actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={onResetSettings}
              >
                Reset settings
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
