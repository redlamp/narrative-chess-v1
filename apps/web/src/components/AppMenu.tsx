import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import type { AppSettings } from "../appSettings";

type AppMenuProps = {
  isOpen: boolean;
  settings: AppSettings;
  onOpenChange: (open: boolean) => void;
  onResetSettings: () => void;
  onThemeChange: (value: AppSettings["theme"]) => void;
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
      <Switch
        checked={checked}
        onCheckedChange={onChange}
      />
    </label>
  );
}

export function AppMenu({
  isOpen,
  settings,
  onOpenChange,
  onResetSettings,
  onThemeChange,
  onDefaultViewModeChange,
  onBooleanSettingChange
}: AppMenuProps) {
  return (
    <DropdownMenu open={isOpen} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon-sm" aria-expanded={isOpen} aria-label="Open settings">
          <Settings2 />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="app-menu__content">
        <div className="app-menu__section">
          <div className="app-menu__section-header">
            <p className="panel__eyebrow">Settings</p>
            <p className="muted">First-pass display and interaction preferences.</p>
          </div>

          <div className="menu-segment">
            <span className="menu-segment__label">Theme</span>
            <div className="menu-segment__actions">
              <Button
                variant={settings.theme === "light" ? "secondary" : "outline"}
                size="sm"
                onClick={() => onThemeChange("light")}
              >
                Light
              </Button>
              <Button
                variant={settings.theme === "dark" ? "secondary" : "outline"}
                size="sm"
                onClick={() => onThemeChange("dark")}
              >
                Dark
              </Button>
            </div>
          </div>

          <div className="menu-segment">
            <span className="menu-segment__label">Default board view</span>
            <div className="menu-segment__actions">
              <Button
                variant={settings.defaultViewMode === "board" ? "secondary" : "outline"}
                size="sm"
                onClick={() => onDefaultViewModeChange("board")}
              >
                Board
              </Button>
              <Button
                variant={settings.defaultViewMode === "map" ? "secondary" : "outline"}
                size="sm"
                onClick={() => onDefaultViewModeChange("map")}
              >
                Map
              </Button>
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
              label="Map labels"
              description="Show district names directly on the tiles in map view."
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
            <Button variant="outline" size="sm" onClick={onResetSettings}>
              Reset settings
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
