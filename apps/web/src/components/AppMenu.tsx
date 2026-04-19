import { useEffect, useId, useRef, useState, type RefObject } from "react";
import {
  ChevronDown,
  Download,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Palette,
  RotateCcw,
  Save,
  Sun,
  User,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { FloatingActionNotice, type FloatingActionNoticeState } from "./FloatingActionNotice";
import { PasswordAuthForm, PasswordUpdateForm } from "./PasswordAuthForm";
import { highlightColorOptions, type AppSettings, type HighlightColor } from "../appSettings";
import type { AppRole } from "../auth";

type AppMenuProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isLayoutModeActive: boolean;
  isLayoutModeDisabled: boolean;
  onToggleLayoutMode: () => void;
  theme: AppSettings["theme"];
  onThemeChange: (theme: AppSettings["theme"]) => void;
  onResetEverything: () => void;
  onSaveEverything: () => void;
  onLoadEverything: () => void;
  isResettingEverything: boolean;
  isSavingEverything: boolean;
  isLoadingEverything: boolean;
  saveEverythingNotice: FloatingActionNoticeState | null;
  onDismissSaveEverythingNotice: () => void;
  highlightColor: HighlightColor;
  onHighlightColorChange: (color: HighlightColor) => void;
  customHighlightColor: string;
  onCustomHighlightColorChange: (color: string) => void;
  playCitySourceLabel: string;
  playCityPreviewModeLabel: string;
  playCityEditionLabel: string | null;
  isPlayCityFallbackMatchKnown: boolean;
};

type UserMenuProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  accountEmail: string | null;
  accountRole: AppRole;
  accountUsername: string | null;
  accountDisplayName: string | null;
  accountEloRating: number | null;
  viewAsRole: AppRole;
  onViewAsRoleChange: (role: AppRole) => void;
  isAuthBusy: boolean;
  onSignInWithPassword: (email: string, password: string) => Promise<string>;
  onSignUpWithPassword: (email: string, password: string) => Promise<string>;
  onSendPasswordResetEmail: (email: string) => Promise<string>;
  onUpdatePassword: (password: string) => Promise<string>;
  onSignOut: () => Promise<string>;
  onSaveProfile: (username: string, displayName: string) => Promise<string>;
};

type AuthNotice = {
  tone: "success" | "error";
  text: string;
};

function roleLabel(role: AppRole) {
  return role === "admin" ? "Admin" : role === "author" ? "Author" : "Player";
}

function useDismissiblePanel({
  isOpen,
  onOpenChange,
  panelRef
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  panelRef: RefObject<HTMLDivElement | null>;
}) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (panelRef.current?.contains(target)) {
        return;
      }

      if (target instanceof Element && target.closest("[data-slot='dropdown-menu-content']")) {
        return;
      }

      onOpenChange(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onOpenChange, panelRef]);
}

export function AppMenu({
  isOpen,
  onOpenChange,
  isLayoutModeActive,
  isLayoutModeDisabled,
  onToggleLayoutMode,
  theme,
  onThemeChange,
  onResetEverything,
  onSaveEverything,
  onLoadEverything,
  isResettingEverything,
  isSavingEverything,
  isLoadingEverything,
  saveEverythingNotice,
  onDismissSaveEverythingNotice,
  highlightColor,
  onHighlightColorChange,
  customHighlightColor,
  onCustomHighlightColorChange,
  playCitySourceLabel,
  playCityPreviewModeLabel,
  playCityEditionLabel,
  isPlayCityFallbackMatchKnown
}: AppMenuProps) {
  const panelId = useId();
  const titleId = useId();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const customColorInputRef = useRef<HTMLInputElement | null>(null);
  const [isPanelHovered, setIsPanelHovered] = useState(false);
  const nextTheme = theme === "dark" ? "light" : "dark";

  useDismissiblePanel({ isOpen, onOpenChange, panelRef: menuRef });

  return (
    <div className="app-menu" ref={menuRef}>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon-sm"
              aria-expanded={isOpen}
              aria-controls={panelId}
              aria-haspopup="dialog"
              aria-label="Open menu"
              onClick={() => onOpenChange(!isOpen)}
            >
              <Menu />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open menu</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {isOpen ? (
        <Card
          id={panelId}
          className="app-menu__content"
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          onMouseEnter={() => setIsPanelHovered(true)}
          onMouseLeave={() => setIsPanelHovered(false)}
        >
          <CardHeader className="app-menu__section-header">
            <div className="app-menu__header-row">
              <h2 id={titleId} className="m-0 text-base font-semibold leading-snug">
                Settings
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="app-menu__close-button"
                aria-label="Close workspace panel"
                onClick={() => onOpenChange(false)}
              >
                <X />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="app-menu__section">
            <div className="app-menu__panel-section">
              <h3 className="app-menu__panel-title">Display</h3>
            </div>

            <div className="grid gap-2">
              <Button
                type="button"
                variant={isLayoutModeActive ? "secondary" : "outline"}
                size="sm"
                onClick={onToggleLayoutMode}
                disabled={isLayoutModeDisabled}
              >
                <LayoutDashboard data-icon="inline-start" />
                {isLayoutModeActive ? "Exit layout" : "Edit layout"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onThemeChange(nextTheme)}
              >
                {theme === "dark" ? <Sun data-icon="inline-start" /> : <Moon data-icon="inline-start" />}
                {theme === "dark" ? "Light theme" : "Dark theme"}
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="app-menu__panel-title">Highlight color</h4>
              <div className="app-menu__color-swatches" role="group" aria-label="Highlight color">
                {highlightColorOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={[
                      "app-menu__color-swatch",
                      highlightColor === option.id ? "app-menu__color-swatch--active" : ""
                    ].filter(Boolean).join(" ")}
                    style={{ backgroundColor: option.hex }}
                    onClick={() => onHighlightColorChange(option.id)}
                    aria-label={option.label}
                    aria-pressed={highlightColor === option.id}
                  />
                ))}
                <Button
                  type="button"
                  variant={highlightColor === "custom" ? "secondary" : "outline"}
                  size="icon-sm"
                  aria-label="Pick custom highlight color"
                  aria-pressed={highlightColor === "custom"}
                  onClick={() => {
                    onHighlightColorChange("custom");
                    customColorInputRef.current?.click();
                  }}
                >
                  <Palette />
                </Button>
                <input
                  ref={customColorInputRef}
                  type="color"
                  className="sr-only"
                  value={customHighlightColor}
                  onChange={(event) => {
                    onCustomHighlightColorChange(event.currentTarget.value);
                    onHighlightColorChange("custom");
                  }}
                  aria-label="Custom highlight color"
                />
              </div>
            </div>

            <div className="app-menu__panel-section">
              <h3 className="app-menu__panel-title">Data</h3>
            </div>

            <div className="app-menu__actions">
              <Button
                variant="outline"
                size="sm"
                onClick={onResetEverything}
                disabled={isResettingEverything || isSavingEverything || isLoadingEverything}
              >
                <RotateCcw data-icon="inline-start" />
                {isResettingEverything ? "Resetting..." : "Reset"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onLoadEverything}
                disabled={isResettingEverything || isSavingEverything || isLoadingEverything}
              >
                <Download data-icon="inline-start" />
                {isLoadingEverything ? "Loading..." : "Load"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={onSaveEverything}
                disabled={isResettingEverything || isSavingEverything || isLoadingEverything}
              >
                <Save data-icon="inline-start" />
                {isSavingEverything ? "Saving..." : "Save"}
              </Button>
            </div>

            <div className="app-menu__panel-section">
              <h3 className="app-menu__panel-title">Network</h3>
            </div>

            <div className="grid gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[0.82rem] text-muted-foreground">Play city mode</span>
                <Badge variant="outline">{playCityPreviewModeLabel}</Badge>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[0.82rem] text-muted-foreground">Play city source</span>
                <Badge variant="outline">{playCitySourceLabel}</Badge>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[0.82rem] text-muted-foreground">Edition</span>
                <span className="text-[0.9rem]">{playCityEditionLabel ?? "None"}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[0.82rem] text-muted-foreground">Fallback parity</span>
                <span className="text-[0.9rem]">
                  {isPlayCityFallbackMatchKnown ? "Known" : "Unknown"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <FloatingActionNotice
        notice={saveEverythingNotice}
        className="app-menu__floating-notice"
        isPaused={isPanelHovered}
        onDismiss={onDismissSaveEverythingNotice}
      />
    </div>
  );
}

export function UserMenu({
  isOpen,
  onOpenChange,
  accountEmail,
  accountRole,
  accountUsername,
  accountDisplayName,
  accountEloRating,
  viewAsRole,
  onViewAsRoleChange,
  isAuthBusy,
  onSignInWithPassword,
  onSignUpWithPassword,
  onSendPasswordResetEmail,
  onUpdatePassword,
  onSignOut,
  onSaveProfile
}: UserMenuProps) {
  const panelId = useId();
  const titleId = useId();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [profileUsername, setProfileUsername] = useState(accountUsername ?? "");
  const [profileDisplayName, setProfileDisplayName] = useState(accountDisplayName ?? "");
  const [authNotice, setAuthNotice] = useState<AuthNotice | null>(null);
  const availableViewAsRoles =
    accountRole === "admin"
      ? (["admin", "author", "player"] as AppRole[])
      : accountRole === "author"
        ? (["author", "player"] as AppRole[])
        : (["player"] as AppRole[]);
  const buttonLabel = accountEmail
    ? accountDisplayName || (accountUsername ? `@${accountUsername}` : accountEmail)
    : "SIGN IN";
  const canEditUsername = accountRole === "admin" || !accountUsername;
  const showRoleControls = accountRole === "author" || accountRole === "admin";

  useDismissiblePanel({ isOpen, onOpenChange, panelRef: menuRef });

  useEffect(() => {
    setProfileUsername(accountUsername ?? "");
    setProfileDisplayName(accountDisplayName ?? "");
  }, [accountDisplayName, accountUsername]);

  const handleAccountSignOut = async () => {
    try {
      await onSignOut();
      setAuthNotice(null);
    } catch (error) {
      setAuthNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Sign-out failed."
      });
    }
  };

  const handleProfileSave = async () => {
    try {
      const message = await onSaveProfile(profileUsername, profileDisplayName);
      setAuthNotice({
        tone: "success",
        text: message
      });
    } catch (error) {
      setAuthNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Profile save failed."
      });
    }
  };

  return (
    <div className="app-menu" ref={menuRef}>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="max-w-48 justify-between gap-2"
              aria-expanded={isOpen}
              aria-controls={panelId}
              aria-haspopup="dialog"
              aria-label={accountEmail ? "Open account details" : "Open sign in"}
              onClick={() => onOpenChange(!isOpen)}
            >
              <span className="truncate">{buttonLabel}</span>
              <User data-icon="inline-end" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{accountEmail ? "Account details" : "Sign in"}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {isOpen ? (
        <Card
          id={panelId}
          className="app-menu__content"
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
        >
          <CardHeader className="app-menu__section-header">
            <div className="app-menu__header-row">
              <h2 id={titleId} className="m-0 text-base font-semibold leading-snug">
                Account Details
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="app-menu__close-button"
                aria-label="Close account panel"
                onClick={() => onOpenChange(false)}
              >
                <X />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="app-menu__section">
            {accountEmail ? (
              <div className="grid gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[0.82rem] text-muted-foreground">Email</span>
                  <span className="text-[0.9rem]">{accountEmail}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[0.82rem] text-muted-foreground">Username</span>
                  <span className="text-[0.9rem]">{accountUsername ? `@${accountUsername}` : "Unset"}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[0.82rem] text-muted-foreground">Elo</span>
                  <Badge variant="outline">{accountEloRating ?? 1200}</Badge>
                </div>
              </div>
            ) : null}

            {accountEmail && showRoleControls ? (
              <>
                <Separator />
                <div className="grid gap-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[0.82rem] text-muted-foreground">Role</span>
                    <Badge variant="outline">{roleLabel(accountRole)}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[0.82rem] text-muted-foreground">View as</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" size="sm" className="min-w-28 justify-between gap-2">
                          <span>{roleLabel(viewAsRole)}</span>
                          <ChevronDown data-icon="inline-end" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-32">
                        {availableViewAsRoles.map((role) => (
                          <DropdownMenuItem key={role} onSelect={() => onViewAsRoleChange(role)}>
                            {roleLabel(role)}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </>
            ) : null}

            {accountEmail ? (
              <>
                <Separator />
                <PasswordUpdateForm
                  isLoading={isAuthBusy}
                  onUpdatePassword={onUpdatePassword}
                />
                <Separator />
                <div className="grid gap-2">
                  {canEditUsername ? (
                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-muted-foreground">Username</span>
                      <Input
                        type="text"
                        autoComplete="off"
                        placeholder="username"
                        value={profileUsername}
                        onChange={(event) => setProfileUsername(event.target.value)}
                        disabled={isAuthBusy}
                      />
                    </label>
                  ) : null}
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Display name</span>
                    <Input
                      type="text"
                      autoComplete="nickname"
                      placeholder="Display name"
                      value={profileDisplayName}
                      onChange={(event) => setProfileDisplayName(event.target.value)}
                      disabled={isAuthBusy}
                    />
                  </label>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleProfileSave}
                    disabled={isAuthBusy}
                  >
                    <Save data-icon="inline-start" />
                    {isAuthBusy ? "Saving..." : "Save profile"}
                  </Button>
                </div>
              </>
            ) : null}

            <div className="app-menu__actions">
              {accountEmail ? (
                <>
                  <Separator className="col-span-full" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAccountSignOut}
                    disabled={isAuthBusy}
                    className="col-span-full"
                  >
                    <LogOut data-icon="inline-start" />
                    {isAuthBusy ? "Signing out..." : "Sign out"}
                  </Button>
                </>
              ) : (
                <div className="col-span-full">
                  <PasswordAuthForm
                    isLoading={isAuthBusy}
                    onSignInWithPassword={onSignInWithPassword}
                    onSignUpWithPassword={onSignUpWithPassword}
                    onSendPasswordResetEmail={onSendPasswordResetEmail}
                  />
                </div>
              )}
            </div>

            {authNotice ? (
              <p
                className={`text-xs leading-[1.45] ${
                  authNotice.tone === "error" ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {authNotice.text}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
