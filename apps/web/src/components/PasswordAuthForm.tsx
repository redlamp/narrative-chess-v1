import { useId, useState, type ComponentPropsWithoutRef, type FormEvent } from "react";
import { LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type PasswordAuthMode = "sign-in" | "sign-up";

type PasswordAuthFormProps = ComponentPropsWithoutRef<"div"> & {
  isLoading: boolean;
  onSignInWithPassword: (email: string, password: string) => Promise<string>;
  onSignUpWithPassword: (email: string, password: string) => Promise<string>;
};

type AuthNotice = {
  tone: "success" | "error";
  text: string;
};

export function PasswordAuthForm({
  className,
  isLoading,
  onSignInWithPassword,
  onSignUpWithPassword,
  ...props
}: PasswordAuthFormProps) {
  const emailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();
  const [mode, setMode] = useState<PasswordAuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState<AuthNotice | null>(null);

  const isSignUp = mode === "sign-up";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setNotice({ tone: "error", text: "Email and password both needed." });
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      setNotice({ tone: "error", text: "Passwords do not match." });
      return;
    }

    try {
      const message = isSignUp
        ? await onSignUpWithPassword(trimmedEmail, password)
        : await onSignInWithPassword(trimmedEmail, password);
      setPassword("");
      setConfirmPassword("");
      setNotice({ tone: "success", text: message });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error
          ? error.message
          : isSignUp
            ? "Account creation failed."
            : "Sign-in failed."
      });
    }
  };

  const switchMode = (nextMode: PasswordAuthMode) => {
    setMode(nextMode);
    setPassword("");
    setConfirmPassword("");
    setNotice(null);
  };

  return (
    <div className={cn("flex flex-col gap-3", className)} {...props}>
      <Card size="sm">
        <CardHeader>
          <CardTitle>{isSignUp ? "Create account" : "Sign in"}</CardTitle>
          <CardDescription>
            {isSignUp
              ? "Create an account with email and password."
              : "Sign in with your email and password."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor={emailId}>Email</Label>
                <Input
                  id={emailId}
                  type="email"
                  autoComplete="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor={passwordId}>Password</Label>
                <Input
                  id={passwordId}
                  type="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  disabled={isLoading}
                />
              </div>

              {isSignUp ? (
                <div className="grid gap-2">
                  <Label htmlFor={confirmPasswordId}>Confirm password</Label>
                  <Input
                    id={confirmPasswordId}
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.currentTarget.value)}
                    disabled={isLoading}
                  />
                </div>
              ) : null}

              {notice ? (
                <p
                  className={cn(
                    "text-xs leading-[1.45]",
                    notice.tone === "error" ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {notice.text}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isSignUp ? (
                  <UserPlus data-icon="inline-start" />
                ) : (
                  <LogIn data-icon="inline-start" />
                )}
                {isLoading
                  ? "Working..."
                  : isSignUp
                    ? "Create account"
                    : "Sign in"}
              </Button>
            </div>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto px-0"
              onClick={() => switchMode(isSignUp ? "sign-in" : "sign-up")}
              disabled={isLoading}
            >
              {isSignUp ? "Sign in" : "Create one"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
