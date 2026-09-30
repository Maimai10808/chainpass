import assert from "node:assert/strict";
import test from "node:test";

import {
  CHAINPASS_SEPOLIA_CHAIN_ID,
  chainPassSepolia,
  getAddressExplorerUrl,
  getTransactionExplorerUrl,
} from "./index.ts";

const address = "0x1234567890123456789012345678901234567890";
const transactionHash =
  "0x1234567890123456789012345678901234567890123456789012345678901234";

test("uses Ethereum Sepolia as the ChainPass test network", () => {
  assert.equal(CHAINPASS_SEPOLIA_CHAIN_ID, 11_155_111);
  assert.equal(chainPassSepolia.id, 11_155_111);
  assert.equal(chainPassSepolia.name, "Sepolia");
  assert.equal(
    chainPassSepolia.blockExplorers.default.url,
    "https://sepolia.etherscan.io",
  );
});

test("builds Ethereum Sepolia explorer links", () => {
  assert.equal(
    getTransactionExplorerUrl(CHAINPASS_SEPOLIA_CHAIN_ID, transactionHash),
    `https://sepolia.etherscan.io/tx/${transactionHash}`,
  );
  assert.equal(
    getAddressExplorerUrl(CHAINPASS_SEPOLIA_CHAIN_ID, address),
    `https://sepolia.etherscan.io/address/${address}`,
  );
  assert.equal(getTransactionExplorerUrl(1, transactionHash), null);
  assert.equal(getAddressExplorerUrl(1, address), null);
});
