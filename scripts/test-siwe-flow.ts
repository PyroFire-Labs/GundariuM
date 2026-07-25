import { createSiweMessage } from "viem/siwe";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { createWalletClient, http } from "viem";
import { base } from "viem/chains";

const BASE_URL = "http://localhost:3000";

async function main() {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, chain: base, transport: http() });
  console.log("Test account:", account.address);

  // First prove the 401 path actually works: a real message with a
  // deliberately wrong signature must be rejected, not silently accepted.
  const { nonce: badNonce } = await fetch(`${BASE_URL}/api/auth/nonce`).then((r) => r.json());
  const badMessage = createSiweMessage({
    address: account.address,
    chainId: base.id,
    domain: "localhost:3000",
    nonce: badNonce,
    uri: BASE_URL,
    version: "1",
    statement: "Sign in to GundariuM",
  });
  const wrongAccount = privateKeyToAccount(generatePrivateKey());
  const wrongWalletClient = createWalletClient({ account: wrongAccount, chain: base, transport: http() });
  const wrongSignature = await wrongWalletClient.signMessage({ message: badMessage });
  const badSigRes = await fetch(`${BASE_URL}/api/auth/siwe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: badMessage, signature: wrongSignature }),
  });
  console.log("Wrong-signer attempt status (expect 401):", badSigRes.status);
  if (badSigRes.status !== 401) throw new Error("Invalid signature was not rejected!");

  // Now the real, correctly-signed flow — needs its own fresh nonce, since
  // the bad-signature attempt above already consumed badNonce.
  const { nonce } = await fetch(`${BASE_URL}/api/auth/nonce`).then((r) => r.json());
  console.log("Got nonce:", nonce);

  const message = createSiweMessage({
    address: account.address,
    chainId: base.id,
    domain: "localhost:3000",
    nonce,
    uri: BASE_URL,
    version: "1",
    statement: "Sign in to GundariuM",
  });
  const signature = await walletClient.signMessage({ message });
  console.log("Signed message");

  const verifyRes = await fetch(`${BASE_URL}/api/auth/siwe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, signature }),
  });
  const verifyData = await verifyRes.json();
  const setCookie = verifyRes.headers.get("set-cookie");
  console.log("Verify response:", verifyRes.status, verifyData);
  console.log("Set-Cookie:", setCookie);

  if (verifyRes.status !== 200) throw new Error("Verify failed");
  if (verifyData.address?.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error("Returned address doesn't match signer");
  }
  if (!setCookie?.includes("gundarium_session=")) {
    throw new Error("No session cookie set");
  }

  console.log("\n✅ SIWE verify + cookie checks passed (session/logout covered in Task 5's script)");
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
