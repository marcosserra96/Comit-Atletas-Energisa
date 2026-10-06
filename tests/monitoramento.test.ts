import { test } from "node:test";
import assert from "node:assert/strict";
import type { ErrorEvent } from "@sentry/nextjs";
import { filtrarEvento, filtrarRastro, limparTexto, limparUrl } from "../src/lib/monitoramento";

test("limparTexto apaga e-mail, CPF, telefone e tokens", () => {
  const t = limparTexto("Falha para joao.silva@energisa.com.br cpf 123.456.789-09 tel (65) 99999-1234 tk eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghij");
  assert.ok(!t.includes("joao.silva"));
  assert.ok(!t.includes("123.456.789-09"));
  assert.ok(!t.includes("99999-1234"));
  assert.ok(!t.includes("eyJhbGci"));
  assert.ok(t.includes("[email]") && t.includes("[cpf]") && t.includes("[telefone]") && t.includes("[token]"));
});

test("limparTexto preserva mensagens técnicas comuns", () => {
  assert.equal(limparTexto("Cannot read properties of undefined (reading 'nome')"), "Cannot read properties of undefined (reading 'nome')");
});

test("limparUrl descarta query e hash (oobCode da troca de senha)", () => {
  assert.equal(limparUrl("https://x.app/redefinir-senha?mode=resetPassword&oobCode=ABC#top"), "https://x.app/redefinir-senha?[removido]");
  assert.equal(limparUrl("https://x.app/eventos"), "https://x.app/eventos");
});

test("filtrarEvento deixa só o id do usuário e limpa a requisição", () => {
  const evento = {
    user: { id: "uid123", email: "a@b.com", username: "Ana", ip_address: "1.2.3.4" },
    request: {
      url: "https://x.app/presenca/ev1?codigo=QWERTY",
      cookies: { s: "1" },
      data: { senha: "123" },
      headers: { Authorization: "Bearer x", "User-Agent": "Safari", Cookie: "a=1", Referer: "https://x.app/login?e=a@b.com" },
    },
    exception: { values: [{ type: "Error", value: "Usuário ana@x.com não encontrado" }] },
    extra: { email: "ana@x.com", total: 3 },
  } as unknown as ErrorEvent;
  const r = filtrarEvento(evento)!;
  assert.deepEqual(r.user, { id: "uid123" });
  assert.equal(r.request?.url, "https://x.app/presenca/ev1?[removido]");
  assert.equal(r.request?.cookies, undefined);
  assert.equal(r.request?.data, undefined);
  assert.deepEqual(r.request?.headers, { "user-agent": "Safari", referer: "https://x.app/login?[removido]" });
  assert.equal(r.exception?.values?.[0].value, "Usuário [email] não encontrado");
  assert.deepEqual(r.extra, { email: "[removido]", total: 3 });
});

test("filtrarRastro descarta console comum e limpa URLs de navegação", () => {
  assert.equal(filtrarRastro({ category: "console", level: "log", message: "oi" }), null);
  const nav = filtrarRastro({ category: "navigation", data: { from: "/login?voltar=/x", to: "/inicio" } });
  assert.deepEqual(nav?.data, { from: "/login?[removido]", to: "/inicio" });
});
