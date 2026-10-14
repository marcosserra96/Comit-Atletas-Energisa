import { test } from "node:test";
import assert from "node:assert/strict";
import { classificarErroPush, mensagemDeErroPush } from "../src/lib/push/erros";

test("erro de rede do FCM vira orientação de rede", () => {
  const e = Object.assign(new Error("Messaging: A problem occurred while subscribing the user to FCM: TypeError: Failed to fetch (fcmregistrations.googleapis.com) (messaging/token-subscribe-failed)."), { code: "messaging/token-subscribe-failed" });
  assert.equal(classificarErroPush(e), "rede");
  assert.match(mensagemDeErroPush("rede", "computador"), /rede da empresa/);
  assert.match(mensagemDeErroPush("rede", "celular"), /4G/);
});

test("outros motivos", () => {
  assert.equal(classificarErroPush(new DOMException("Registration failed - push service error", "AbortError")), "servico_push");
  assert.equal(classificarErroPush({ code: "messaging/permission-blocked", message: "x" }), "bloqueado");
  assert.equal(classificarErroPush(new Error("Sessão expirada.")), "sessao");
  assert.equal(classificarErroPush(new Error("algo estranho")), "outro");
  assert.doesNotMatch(mensagemDeErroPush("outro", "celular"), /Failed|FCM/);
});
