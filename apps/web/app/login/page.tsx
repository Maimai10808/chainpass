import { AuthForm } from "@/components/auth/auth-form";
export const metadata = { title: "Sign in", robots: { index: false } };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <AuthForm mode="login" next={typeof next === "string" ? next : undefined} />
  );
}
