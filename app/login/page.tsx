import { LoginForm } from "@/components/login-form"
import { ThemeSwitcher } from "@/components/theme-switcher"

export default function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>

      {/* Theme Switcher */}
      <ThemeSwitcher />
    </div>
  )
}
