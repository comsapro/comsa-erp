"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { loginSchema } from "@/domains/auth/schemas";
import { loginAction } from "@/app/(auth)/actions";
import { Field } from "@/components/forms/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/feedback/Alert";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (values) => {
    setServerError("");
    startTransition(async () => {
      const result = await loginAction(values);
      if (result?.ok) {
        const next = searchParams.get("next") || "/";
        router.replace(next);
        router.refresh();
      } else {
        setServerError(result?.error || "No fue posible iniciar sesion.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-content">Iniciar sesion</h2>
        <p className="mt-1 text-sm text-content-muted">
          Ingresa tus credenciales para continuar.
        </p>
      </div>

      {serverError && <Alert variant="danger">{serverError}</Alert>}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
        noValidate
      >
        <Field
          label="Correo electronico"
          htmlFor="email"
          required
          error={errors.email?.message}
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="usuario@comsa.com"
            invalid={!!errors.email}
            {...register("email")}
          />
        </Field>

        <Field
          label="Contrasena"
          htmlFor="password"
          required
          error={errors.password?.message}
        >
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="********"
              className="pr-10"
              invalid={!!errors.password}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-content-muted hover:text-content"
              aria-label={
                showPassword ? "Ocultar contrasena" : "Mostrar contrasena"
              }
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </Field>

        <Button type="submit" loading={isPending} className="mt-1 w-full">
          Entrar
        </Button>
      </form>

      <div className="text-center">
        <Link
          href="/recuperar-acceso"
          className="text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline"
        >
          Olvide mi contrasena
        </Link>
      </div>
    </div>
  );
}
