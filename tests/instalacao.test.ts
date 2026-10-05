import assert from "node:assert/strict";
import test from "node:test";
import { detectarAparelho, detectarNavegador } from "../src/lib/pwa/instalacao";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.7204.156 Mobile/15E148 Safari/604.1",
  iphoneInstagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22F76 Instagram 389.0.0.29.88",
  iphoneWebView: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22F76",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36",
  androidWhatsapp:
    "Mozilla/5.0 (Linux; Android 14; SM-A546E; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/138.0.0.0 Mobile Safari/537.36",
  androidSamsung:
    "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36",
  windowsChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
};

function detectar(ua: string) {
  const aparelho = detectarAparelho(ua);
  return [aparelho, detectarNavegador(ua, aparelho)];
}

test("instalação: aparelho e navegador", () => {
  assert.deepEqual(detectar(UA.iphoneSafari), ["iphone", "safari"]);
  assert.deepEqual(detectar(UA.iphoneChrome), ["iphone", "chrome"]);
  assert.deepEqual(detectar(UA.iphoneInstagram), ["iphone", "interno"]);
  assert.deepEqual(detectar(UA.iphoneWebView), ["iphone", "interno"]);
  assert.deepEqual(detectar(UA.androidChrome), ["android", "chrome"]);
  assert.deepEqual(detectar(UA.androidWhatsapp), ["android", "interno"]);
  assert.deepEqual(detectar(UA.androidSamsung), ["android", "outro"]);
  assert.deepEqual(detectar(UA.windowsChrome), ["computador", "chrome"]);
  // iPad com iPadOS se apresenta como Mac, mas com toque.
  assert.equal(detectarAparelho("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 5), "iphone");
});
