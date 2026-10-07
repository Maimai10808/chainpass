import { AuthForm } from "@/components/auth/auth-form";
export const metadata = {
  title: "Create an account",
  robots: { index: false },
};
export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
