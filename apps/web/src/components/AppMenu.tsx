import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Download, LogIn, LogOut, Menu, RotateCcw, Save, UserPlus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FloatingActionNotice, type FloatingActionNoticeState } from "./FloatingActionNotice";
import { highlightColorOptions, type HighlightColor } from "../appSettings";
import type { AppRole } from "../auth";

type AppMenuProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
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
  accountEmail: string | null;
  accountRole: AppRole;
  accountUsername: string | null;
  accountDisplayName: string | null;
  accountEloRating: number | null;
  viewAsRole: AppRole;
  onViewAsRoleChange: (role: AppRole) => void;
  canAccessDraftCities: boolean;
  isAuthBusy: boolean;
  onSignInWithPassword: (email: string, password: string) => Promise<string>;
  onSignUpWithPassword: (email: string, password: string) => Promise<string>;
  onSignOut: () => Promise<string>;
  onSaveProfile: (username: string, displayName: string) => Promise<string>;
  playCitySourceLabel: string;
  playCityPreviewModeLabel: string;
  playCityEditionLabel: string | null;
  isPlayCityFallbackMatchKnown: boolean;
};

type AuthNotice = {
  tone: "success" | "error";
  text: string;
};

function roleLabel(role: AppRole) {
  return role === "admin" ? "Admin" : role === "author" ? "Author" : "Player";
}

export function AppMenu({
  isOpen,
  onOpenChange,
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
  accountEmail,
  accountRole,
  accountUsername,
  accountDisplayName,
  accountEloRating,
  viewAsRole,
  onViewAsRoleChange,
  canAccessDraftCities,
  isAuthBusy,
  onSignInWithPassword,
  onSignUpWithPassword,
  onSignOut,
  onSaveProfile,
  playCitySourceLabel,
  playCityPreviewModeLabel,
  playCityEditionLabel,
  isPlayCityFallbackMatchKnown
}: AppMenuProps) {
  const panelId = useId();
  const titleId = useId();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isPanelHovered, setIsPanelHovered] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [profileUsername, setProfileUsername] = useState(accountUsername ?? "");
  const [profileDisplayName, setProfileDisplayName] = useState(accountDisplayName ?? "");
  const [authNotice, setAuthNotice] = useState<AuthNotice | null>(null);
  const availableViewAsRoles =
    accountRole === "admin"
      ? (["admin", "author", "player"] as AppRole[])
      : accountRole === "author"
        ? (["author", "player"] as AppRole[])
        : (["player"] as AppRole[]);

  useEffect(() => {
    setProfileUsername(accountUsername ?? "");
    setProfileDisplayName(accountDisplayName ?? "");
  }, [accountDisplayName, accountUsername]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (menuRef.current?.contains(target)) {
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
  }, [isOpen, onOpenChange]);

  const getAuthInput = () => {
    const email = authEmail.trim();
    const password = authPassword;
    if (!email || !password) {
      setAuthNotice({
        tone: "error",
        text: "Email and password both needed."
      });
      return null;
    }

    return { email, password };
  };

  const handlePasswordSignIn = async () => {
    const input = getAuthInput();
    if (!input) {
      return;
    }

    try {
      const message = await onSignInWithPassword(input.email, input.password);
      setAuthPassword("");
      setAuthNotice({
        tone: "success",
        text: message
      });
    } catch (error) {
      setAuthNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Sign-in failed."
      });
    }
  };

  const handlePasswordSignUp = async () => {
    const input = getAuthInput();
    if (!input) {
      return;
    }

    try {
      const message = await onSignUpWithPassword(input.email, input.password);
      setAuthPassword("");
      setAuthNotice({
        tone: "success",
        text: message
      });
    } catch (error) {
      setAuthNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Account creation failed."
      });
    }
  };

  const handleAccountSignOut = async () => {
    try {
      const message = await onSignOut();
      setAuthPassword("");
      setAuthNotice({
        tone: "success",
        text: message
      });
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
          size="sm"
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          onMouseEnter={() => setIsPanelHovered(true)}
          onMouseLeave={() => setIsPanelHovered(false)}
        >
          <CardHeader className="app-menu__section-header">
            <div className="app-menu__header-row">
              <CardTitle id={titleId}>Workspace</CardTitle>
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
              <h3 className="app-menu__panel-title">Highlight color</h3>
            </div>

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
            </div>

            <div className="app-menu__panel-section">
              <h3 className="app-menu__panel-title">Account Details</h3>
            </div>

            <div className="grid gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[0.82rem] text-muted-foreground">Signed in</span>
                <span className="text-[0.9rem]">{accountEmail ?? "No"}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[0.82rem] text-muted-foreground">Role</span>
                <Badge variant="outline">{roleLabel(accountRole)}</Badge>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[0.82rem] text-muted-foreground">Username</span>
                <span className="text-[0.9rem]">{accountUsername ? `@${accountUsername}` : "Unset"}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[0.82rem] text-muted-foreground">Elo</span>
                <Badge variant="outline">{accountEloRating ?? 1200}</Badge>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[0.82rem] text-muted-foreground">View as</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="min-w-28 justify-between gap-2">
                      <span>{roleLabel(viewAsRole)}</span>
                      <ChevronDown className="size-4 text-muted-foreground" />
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[0.82rem] text-muted-foreground">Draft city access</span>
                <Badge variant={canAccessDraftCities ? "secondary" : "outline"}>
                  {canAccessDraftCities ? "Allowed" : "Published only"}
                </Badge>
              </div>
            </div>

            {accountEmail ? (
              <div className="grid gap-2">
                <Input
                  type="text"
                  autoComplete="off"
                  placeholder="username"
                  value={profileUsername}
                  onChange={(event) => setProfileUsername(event.target.value)}
                  disabled={isAuthBusy}
                />
                <Input
                  type="text"
                  autoComplete="nickname"
                  placeholder="Display name"
                  value={profileDisplayName}
                  onChange={(event) => setProfileDisplayName(event.target.value)}
                  disabled={isAuthBusy}
                />
                <p className="text-xs leading-[1.45] text-muted-foreground">
                  Username is for invites and multiplayer identity. Use lowercase letters, numbers,
                  or underscores.
                </p>
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
            ) : null}

            <div className="app-menu__actions">
              {accountEmail ? (
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
              ) : (
                <div className="col-span-full grid gap-2">
                  <div className="grid gap-2">
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="Email"
                      value={authEmail}
                      onChange={(event) => setAuthEmail(event.target.value)}
                      disabled={isAuthBusy}
                    />
                    <Input
                      type="password"
                      autoComplete="current-password"
                      placeholder="Password"
                      value={authPassword}
                      onChange={(event) => setAuthPassword(event.target.value)}
                      disabled={isAuthBusy}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePasswordSignIn}
                      disabled={isAuthBusy}
                    >
                      <LogIn data-icon="inline-start" />
                      {isAuthBusy ? "Working..." : "Sign in"}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handlePasswordSignUp}
                      disabled={isAuthBusy}
                    >
                      <UserPlus data-icon="inline-start" />
                      {isAuthBusy ? "Working..." : "Create account"}
                    </Button>
                  </div>
                  <p className="text-xs leading-[1.45] text-muted-foreground">
                    Supabase handles the account. If email confirmation is on, check inbox after
                    sign-up.
                  </p>
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

            <div className="app-menu__panel-section">
              <h3 className="app-menu__panel-title">Network Details</h3>
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
