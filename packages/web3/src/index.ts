import {
  getAddress,
  keccak256,
  stringToHex,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { sepolia } from "viem/chains";

export { chainPassAbi } from "@chainpass/web3/abi";

export const CHAINPASS_SEPOLIA_CHAIN_ID = sepolia.id;
export const chainPassSepolia = sepolia;

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
  if (chainId !== CHAINPASS_SEPOLIA_CHAIN_ID) return null;

  return `${sepolia.blockExplorers.default.url}/tx/${transactionHash}`;
}

export function getAddressExplorerUrl(
  chainId: number,
  address: Address,
): string | null {
  if (chainId !== CHAINPASS_SEPOLIA_CHAIN_ID) return null;

  return `${sepolia.blockExplorers.default.url}/address/${address}`;
}

export type { Address, Hash, Hex };
