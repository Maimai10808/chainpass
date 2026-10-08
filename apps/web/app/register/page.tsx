import { AuthForm } from "@/components/auth/auth-form";
export const metadata = {
  title: "Create an account",
  robots: { index: false },
};
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <AuthForm
      mode="register"
      next={typeof next === "string" ? next : undefined}
    />
  );
}
