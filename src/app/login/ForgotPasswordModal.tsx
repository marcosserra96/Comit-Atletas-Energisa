"use client";

import { FormEvent, useEffect, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { Mail } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { auth } from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import { firebaseErrorCode, mapFirebaseError } from "@/lib/firebaseErrors";

export function ForgotPasswordModal({
  open,
  onClose,
  initialEmail,
}: {
  open: boolean;
  onClose: () => void;
  initialEmail: string;
}) {
  const { show } = useToast();
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail(initialEmail);
      setError("");
    }
  }, [initialEmail, open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      await sendPasswordResetEmail(auth, normalizedEmail, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      });
      show("success", "Enviamos um link de redefinição para o seu e-mail.");
      onClose();
    } catch (requestError) {
      setError(mapFirebaseError(firebaseErrorCode(requestError)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Redefinir senha"
      description="Digite seu e-mail institucional e enviaremos um link para você criar uma nova senha."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="E-mail"
          type="email"
          icon={<Mail className="size-[18px]" />}
          placeholder="voce@energisa.com.br"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError("");
          }}
          error={error}
          autoComplete="email"
          inputMode="email"
          required
          autoFocus
        />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Enviar link
          </Button>
        </div>
      </form>
    </Modal>
  );
}
