import {
  getAddress,
  keccak256,
  stringToHex,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { baseSepolia } from "viem/chains";

export { chainPassAbi } from "@chainpass/web3/abi";

export const CHAINPASS_BASE_SEPOLIA_CHAIN_ID = 84_532;
export const chainPassBaseSepolia = baseSepolia;

export function canonicalizeEvmAddress(address: string): Address {
  return getAddress(address);
}

export function createPassHash(passId: string): Hex {
  return keccak256(stringToHex(passId));
}

export function getTransactionExplorerUrl(
  chainId: number,
  transactionHash: Hash,
): string | null {
  if (chainId !== CHAINPASS_BASE_SEPOLIA_CHAIN_ID) return null;

  return `${baseSepolia.blockExplorers.default.url}/tx/${transactionHash}`;
}

export type { Address, Hash, Hex };
