import test from "node:test";
import assert from "node:assert/strict";
import { linkDoMapa, locaisUsados, semRepetidos, siglaDoEstado, sugestaoDoMapa } from "../src/lib/locais";

test("mapa: lugar com nome vira 'Nome, Cidade' e guarda as coordenadas", () => {
  const s = sugestaoDoMapa({
    geometry: { coordinates: [-46.6575, -23.5874] },
    properties: { name: "Parque Ibirapuera", street: "Avenida Pedro Álvares Cabral", district: "Vila Mariana", city: "São Paulo", state: "São Paulo", countrycode: "BR", osm_value: "park" },
  })!;
  assert.equal(s.valor, "Parque Ibirapuera, São Paulo");
  assert.equal(s.detalhe, "Avenida Pedro Álvares Cabral, Vila Mariana, São Paulo - SP");
  assert.deepEqual(s.coordenadas, { lat: -23.5874, lng: -46.6575 });
});

test("mapa: cidade vira 'Cidade, UF'; fora do Brasil fica de fora; endereço sem nome usa a rua", () => {
  const c = sugestaoDoMapa({ geometry: { coordinates: [-42.69, -21.39] }, properties: { name: "Cataguases", state: "Minas Gerais", countrycode: "BR", osm_value: "town" } })!;
  assert.equal(c.valor, "Cataguases, MG");
  assert.equal(sugestaoDoMapa({ properties: { name: "Lisboa", countrycode: "PT" } }), null);
  const r = sugestaoDoMapa({ properties: { street: "Rua Coronel João Duarte", housenumber: "100", city: "Cataguases", state: "Minas Gerais", countrycode: "BR" } })!;
  assert.equal(r.valor, "Rua Coronel João Duarte, 100, Cataguases");
  assert.equal(siglaDoEstado("Espírito Santo"), "ES");
});

test("locais usados: mais frequentes primeiro, busca sem acento e por palavra, sem 'Online'", () => {
  const eventos = [
    { local: "Auditório Energisa" },
    { local: "Auditório Energisa", coordenadas: { lat: 1, lng: 2 } },
    { local: "Parque do Ibirapuera, São Paulo" },
    { local: "Online", online: true },
    { local: "Cataguases" },
  ];
  assert.deepEqual(locaisUsados(eventos, "").map((s) => s.valor), ["Auditório Energisa", "Cataguases", "Parque do Ibirapuera, São Paulo"]);
  assert.deepEqual(locaisUsados(eventos, "ibira sao").map((s) => s.valor), ["Parque do Ibirapuera, São Paulo"]);
  const aud = locaisUsados(eventos, "auditorio")[0];
  assert.equal(aud.detalhe, "Usado em 2 eventos");
  assert.deepEqual(aud.coordenadas, { lat: 1, lng: 2 });
  // O que já está escrito igual não aparece como sugestão.
  assert.equal(locaisUsados(eventos, "Cataguases").length, 0);
  assert.equal(semRepetidos([...locaisUsados(eventos, "cata"), { valor: "cataguases", titulo: "", detalhe: "", origem: "mapa" }]).length, 1);
});

test("link do mapa usa coordenadas quando existem", () => {
  assert.match(linkDoMapa({ local: "X", coordenadas: { lat: -21.39, lng: -42.69 } }), /query=-21\.39%2C-42\.69$/);
  assert.match(linkDoMapa({ local: "Auditório Energisa" }), /query=Audit%C3%B3rio%20Energisa$/);
});
