"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react";
import { authClient, signIn, signUp, useSession } from "@/lib/auth-client";
import { loginDestination } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "@/components/ui/field";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});
const registerSchema = loginSchema
  .extend({
    name: z.string().trim().min(1, "Enter your name").max(100),
    password: z.string().min(8, "Use at least 8 characters").max(128),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
type FormValues = {
  email: string;
  password: string;
  name?: string;
  confirmPassword?: string;
};

export function AuthForm({
  mode,
  next,
}: {
  mode: "login" | "register";
  next?: string;
}) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [visible, setVisible] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isRegister = mode === "register";
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(isRegister ? registerSchema : loginSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });
  useEffect(() => {
    if (session) router.replace(loginDestination(session.user.role, next));
  }, [isRegister, next, router, session]);

  async function submit(values: FormValues) {
    setSubmitError(null);
    try {
      const result = isRegister
        ? await signUp.email({
            name: values.name ?? "",
            email: values.email,
            password: values.password,
          })
        : await signIn.email({
            email: values.email,
            password: values.password,
          });
      if (result.error) {
        setSubmitError(
          result.error.message ?? "Unable to sign in. Check your details.",
        );
        return;
      }
      const current = await authClient.getSession();
      if (!current.data) {
        setSubmitError(
          "Unable to restore your session. Please try signing in.",
        );
        return;
      }
      toast.success(isRegister ? "Welcome to ChainPass" : "Signed in");
      router.replace(loginDestination(current.data.user.role, next));
      router.refresh();
    } catch {
      setSubmitError("Unable to connect. Please try again.");
    }
  }
  return (
    <div className="mx-auto grid max-w-5xl items-center gap-12 py-4 lg:grid-cols-2 lg:py-10">
      <div className="hidden lg:block">
        <p className="mb-5 font-mono text-caption uppercase tracking-widest text-primary">
          One identity. Every experience.
        </p>
        <h2 className="text-display font-semibold leading-tight tracking-tight">
          Your next chapter
          <br />
          <span className="text-gradient">starts here.</span>
        </h2>
        <p className="mt-6 max-w-sm text-muted-foreground">
          Discover experiences. Keep your passes in one place. Prove ownership
          when it matters.
        </p>
        <p className="mt-10 flex items-center gap-2 text-body-sm text-muted-foreground">
          <ShieldCheck className="size-4 text-info" />
          Email is your identity. Wallet is your proof.
        </p>
      </div>
      <Card className="w-full max-w-md justify-self-center">
        <CardHeader>
          <CardTitle className="text-h2">
            <h1>{isRegister ? "Create your account" : "Welcome back"}</h1>
          </CardTitle>
          <CardDescription>
            {isRegister
              ? "Your pass to the next experience. No wallet required."
              : "Sign in to your ChainPass workspace."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(submit)} noValidate>
            <FieldGroup>
              {isRegister && (
                <Field data-invalid={Boolean(errors.name)}>
                  <FieldLabel htmlFor="name">Name</FieldLabel>
                  <Input
                    id="name"
                    autoComplete="name"
                    aria-invalid={Boolean(errors.name)}
                    {...register("name")}
                  />
                  <FieldError errors={[errors.name]} />
                </Field>
              )}
              <Field data-invalid={Boolean(errors.email)}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={Boolean(errors.email)}
                  {...register("email")}
                />
                <FieldError errors={[errors.email]} />
              </Field>
              <Field data-invalid={Boolean(errors.password)}>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Button
                    size="xs"
                    variant="ghost"
                    type="button"
                    aria-label={visible ? "Hide password" : "Show password"}
                    aria-pressed={visible}
                    onClick={() => setVisible(!visible)}
                  >
                    {visible ? (
                      <EyeOff data-icon="inline-start" />
                    ) : (
                      <Eye data-icon="inline-start" />
                    )}
                    {visible ? "Hide" : "Show"}
                  </Button>
                </div>
                <Input
                  id="password"
                  type={visible ? "text" : "password"}
                  autoComplete={
                    isRegister ? "new-password" : "current-password"
                  }
                  aria-invalid={Boolean(errors.password)}
                  {...register("password")}
                />
                <FieldError errors={[errors.password]} />
                {isRegister && (
                  <FieldDescription>
                    At least 8 characters. Use a unique password.
                  </FieldDescription>
                )}
              </Field>
              {isRegister && (
                <Field data-invalid={Boolean(errors.confirmPassword)}>
                  <FieldLabel htmlFor="confirm-password">
                    Confirm password
                  </FieldLabel>
                  <Input
                    id="confirm-password"
                    type={visible ? "text" : "password"}
                    autoComplete="new-password"
                    aria-invalid={Boolean(errors.confirmPassword)}
                    {...register("confirmPassword")}
                  />
                  <FieldError errors={[errors.confirmPassword]} />
                </Field>
              )}
              {submitError && (
                <Alert variant="destructive">
                  <AlertTitle>
                    {isRegister ? "Registration failed" : "Sign in failed"}
                  </AlertTitle>
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}
              <Button
                size="lg"
                className="h-11 w-full"
                type="submit"
                disabled={isSubmitting || isPending || Boolean(session)}
              >
                {isSubmitting ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <ArrowRight data-icon="inline-end" />
                )}
                {isSubmitting
                  ? "Please wait…"
                  : isRegister
                    ? "Create account"
                    : "Sign in"}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 text-body-sm">
          <p className="text-muted-foreground">
            {isRegister ? "Already have an account? " : "New to ChainPass? "}
            <Link
              className="text-primary hover:underline"
              href={
                (isRegister ? "/login" : "/register") +
                (next
                  ? "?next=" +
                    encodeURIComponent(loginDestination("user", next))
                  : "")
              }
            >
              {isRegister ? "Sign in" : "Create an account"}
            </Link>
          </p>
          {isRegister && (
            <p className="text-caption text-muted-foreground">
              Organizer access is granted by a platform administrator.
            </p>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
