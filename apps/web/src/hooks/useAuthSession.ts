import { useCallback, useEffect, useState } from "react";
import {
  bootstrapFirstAdmin,
  getCurrentSession,
  loadCurrentUserRole,
  signInWithPassword,
  signUpWithPassword,
  sendPasswordResetEmail,
  signOut,
  subscribeToAuthChanges,
  updatePassword,
  type AppRole
} from "../auth";
import {
  loadCurrentUserProfile,
  saveCurrentUserProfile,
  type UserProfile
} from "../profiles";

export type AuthSession = {
  sessionEmail: string | null;
  sessionRole: AppRole;
  sessionProfile: UserProfile | null;
  viewAsRole: AppRole;
  setViewAsRole: (role: AppRole) => void;
  isAuthBusy: boolean;
  handleSignInWithPassword: (email: string, password: string) => Promise<string>;
  handleSignUpWithPassword: (email: string, password: string) => Promise<string>;
  handleSendPasswordResetEmail: (email: string) => Promise<string>;
  handleUpdatePassword: (password: string) => Promise<string>;
  handleSignOut: () => Promise<string>;
  handleSaveProfile: (username: string, displayName: string) => Promise<string>;
};

export function useAuthSession(): AuthSession {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionRole, setSessionRole] = useState<AppRole>("player");
  const [sessionProfile, setSessionProfile] = useState<UserProfile | null>(null);
  const [viewAsRole, setViewAsRole] = useState<AppRole>("player");
  const [isAuthBusy, setIsAuthBusy] = useState(false);

  const resolveAppRole = useCallback(async (user: { id: string } | null) => {
    const initialRole = await loadCurrentUserRole(user);
    if (!user || initialRole !== "player") {
      return initialRole;
    }

    const nextRole = await bootstrapFirstAdmin();
    if (nextRole === "admin") {
      return "admin" as AppRole;
    }

    return loadCurrentUserRole(user);
  }, []);

  const refreshCurrentUserProfile = useCallback(async (user: { id: string } | null) => {
    if (!user) {
      setSessionProfile(null);
      return;
    }

    try {
      setSessionProfile(await loadCurrentUserProfile());
    } catch (error) {
      console.warn("[supabase] Could not read current profile.", error);
      setSessionProfile(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const applySessionState = async () => {
      try {
        const session = await getCurrentSession();
        if (cancelled) {
          return;
        }

        const user = session?.user ?? null;
        setSessionEmail(user?.email ?? null);
        setSessionRole(await resolveAppRole(user));
        await refreshCurrentUserProfile(user);
      } catch (error) {
        if (!cancelled) {
          console.warn("[supabase] Could not read current auth session.", error);
          setSessionEmail(null);
          setSessionRole("player");
          setSessionProfile(null);
        }
      }
    };

    void applySessionState();

    const unsubscribe = subscribeToAuthChanges((session) => {
      const user = session?.user ?? null;
      setSessionEmail(user?.email ?? null);
      void refreshCurrentUserProfile(user);
      void resolveAppRole(user)
        .then((role) => {
          if (!cancelled) {
            setSessionRole(role);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            console.warn("[supabase] Could not read user role.", error);
            setSessionRole("player");
          }
        });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [refreshCurrentUserProfile, resolveAppRole]);

  useEffect(() => {
    const allowedViewAsRoles =
      sessionRole === "admin"
        ? (["admin", "author", "player"] as AppRole[])
        : sessionRole === "author"
          ? (["author", "player"] as AppRole[])
          : (["player"] as AppRole[]);

    if (!allowedViewAsRoles.includes(viewAsRole)) {
      setViewAsRole(allowedViewAsRoles[0]);
    }
  }, [sessionRole, viewAsRole]);

  const maybeBootstrapAdmin = useCallback(async () => {
    try {
      const nextRole = await bootstrapFirstAdmin();
      if (nextRole === "admin") {
        setSessionRole("admin");
        return true;
      }
    } catch (error) {
      console.warn("[supabase] First-admin bootstrap failed.", error);
    }

    return false;
  }, []);

  const handleSignInWithPassword = useCallback(async (email: string, password: string) => {
    setIsAuthBusy(true);
    try {
      const result = await signInWithPassword({ email, password });
      if (result.error) {
        throw result.error;
      }
      const didBootstrapAdmin = await maybeBootstrapAdmin();
      return didBootstrapAdmin ? "Signed in. First admin claimed." : "Signed in.";
    } catch (error) {
      console.warn("[supabase] Email/password sign-in failed.", error);
      throw error;
    } finally {
      setIsAuthBusy(false);
    }
  }, [maybeBootstrapAdmin]);

  const handleSignUpWithPassword = useCallback(async (email: string, password: string) => {
    setIsAuthBusy(true);
    try {
      const result = await signUpWithPassword({ email, password });
      if (result.error) {
        throw result.error;
      }

      if (result.data.session) {
        const didBootstrapAdmin = await maybeBootstrapAdmin();
        return didBootstrapAdmin
          ? "Account created. First admin claimed."
          : "Account created and signed in.";
      }

      return "Account created. If email confirmation is enabled, confirm first, then sign in.";
    } catch (error) {
      console.warn("[supabase] Email/password sign-up failed.", error);
      throw error;
    } finally {
      setIsAuthBusy(false);
    }
  }, [maybeBootstrapAdmin]);

  const handleSendPasswordResetEmail = useCallback(async (email: string) => {
    setIsAuthBusy(true);
    try {
      const result = await sendPasswordResetEmail(email);
      if (result.error) {
        throw result.error;
      }
      return "Password reset email sent.";
    } catch (error) {
      console.warn("[supabase] Password reset email failed.", error);
      throw error;
    } finally {
      setIsAuthBusy(false);
    }
  }, []);

  const handleUpdatePassword = useCallback(async (password: string) => {
    setIsAuthBusy(true);
    try {
      const result = await updatePassword(password);
      if (result.error) {
        throw result.error;
      }
      return "Password updated.";
    } catch (error) {
      console.warn("[supabase] Password update failed.", error);
      throw error;
    } finally {
      setIsAuthBusy(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    setIsAuthBusy(true);
    try {
      await signOut();
      setSessionRole("player");
      setSessionProfile(null);
      setViewAsRole("player");
      return "Signed out.";
    } catch (error) {
      console.warn("[supabase] Sign-out failed.", error);
      throw error;
    } finally {
      setIsAuthBusy(false);
    }
  }, []);

  const handleSaveProfile = useCallback(async (username: string, displayName: string) => {
    setIsAuthBusy(true);
    try {
      const profile = await saveCurrentUserProfile({ username, displayName });
      setSessionProfile(profile);
      return profile.username
        ? `Profile saved as @${profile.username}.`
        : "Profile saved.";
    } catch (error) {
      console.warn("[supabase] Could not save profile.", error);
      throw error;
    } finally {
      setIsAuthBusy(false);
    }
  }, []);

  return {
    sessionEmail,
    sessionRole,
    sessionProfile,
    viewAsRole,
    setViewAsRole,
    isAuthBusy,
    handleSignInWithPassword,
    handleSignUpWithPassword,
    handleSendPasswordResetEmail,
    handleUpdatePassword,
    handleSignOut,
    handleSaveProfile
  };
}
