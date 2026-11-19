import { test } from "node:test";
import assert from "node:assert/strict";
import { ehFotoExibivel, ordenarArquivos } from "../src/lib/retrospectivaFotos";

test("retrospectiva: aceita JPG, PNG e WebP e ordena pela data do arquivo", () => {
  assert.equal(ehFotoExibivel({ type: "image/jpeg", name: "a.jpg" }), true);
  assert.equal(ehFotoExibivel({ type: "image/heic", name: "a.heic" }), false);
  assert.equal(ehFotoExibivel({ type: "", name: "IMG_1.PNG" }), true);
  assert.equal(ehFotoExibivel({ type: "text/plain", name: "x.txt" }), false);
  const ordem = ordenarArquivos([
    { name: "IMG_10.jpg", lastModified: 5 },
    { name: "IMG_2.jpg", lastModified: 5 },
    { name: "IMG_1.jpg", lastModified: 9 },
  ]).map((a) => a.name);
  assert.deepEqual(ordem, ["IMG_2.jpg", "IMG_10.jpg", "IMG_1.jpg"]);
});
