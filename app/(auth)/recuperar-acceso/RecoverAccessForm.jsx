"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/domains/auth/schemas";
import {
  forgotPasswordAction,
  resetPasswordAction,
} from "@/app/(auth)/actions";
import { Field } from "@/components/forms/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/feedback/Alert";

function RequestForm() {
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = (values) => {
    startTransition(async () => {
      await forgotPasswordAction(values);
      setSent(true);
    });
  };

  if (sent) {
    return (
      <Alert variant="success" title="Revisa tu correo">
        Si el correo esta registrado, recibiras un enlace para restablecer tu
        contrasena. El enlace es valido por 1 hora.
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <Field
        label="Correo electronico"
        htmlFor="email"
        required
        error={errors.email?.message}
        hint="Te enviaremos un enlace para restablecer tu contrasena."
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
      <Button type="submit" loading={isPending} className="w-full">
        Enviar enlace
      </Button>
    </form>
  );
}

function ResetForm({ token }) {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  const onSubmit = (values) => {
    setServerError("");
    startTransition(async () => {
      const result = await resetPasswordAction(values);
      if (result?.ok) {
        setDone(true);
        setTimeout(() => router.replace("/login"), 1800);
      } else {
        setServerError(result?.error || "No fue posible restablecer la contrasena.");
      }
    });
  };

  if (done) {
    return (
      <Alert variant="success" title="Contrasena actualizada">
        Tu contrasena se restablecio correctamente. Redirigiendo al inicio de
        sesion...
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      {serverError && <Alert variant="danger">{serverError}</Alert>}
      <input type="hidden" {...register("token")} />
      <Field
        label="Nueva contrasena"
        htmlFor="password"
        required
        error={errors.password?.message}
        hint="Minimo 8 caracteres, con letras y numeros."
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          invalid={!!errors.password}
          {...register("password")}
        />
      </Field>
      <Field
        label="Confirmar contrasena"
        htmlFor="confirmPassword"
        required
        error={errors.confirmPassword?.message}
      >
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          invalid={!!errors.confirmPassword}
          {...register("confirmPassword")}
        />
      </Field>
      <Button type="submit" loading={isPending} className="w-full">
        Restablecer contrasena
      </Button>
    </form>
  );
}

export default function RecoverAccessForm({ token }) {
  const isReset = Boolean(token);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-content">
          {isReset ? "Restablecer contrasena" : "Recuperar acceso"}
        </h2>
        <p className="mt-1 text-sm text-content-muted">
          {isReset
            ? "Define tu nueva contrasena."
            : "Ingresa tu correo para recibir instrucciones."}
        </p>
      </div>

      {isReset ? <ResetForm token={token} /> : <RequestForm />}

      <div className="text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a iniciar sesion
        </Link>
      </div>
    </div>
  );
}
