import { chainPassAbi, createPassHash } from '@chainpass/web3';
import { createPublicClient, defineChain, http } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

import { BlockchainService } from '../src/blockchain/blockchain.service.js';

const integrationEnabled = process.env.BLOCKCHAIN_INTEGRATION === 'true';

describe.skipIf(!integrationEnabled)('BlockchainService with Anvil', () => {
  it('mints once, verifies ownership, and recovers the same token on retry', async () => {
    const rpcUrl = requireEnvironment('CHAIN_RPC_URL');
    const chainId = Number(requireEnvironment('CHAIN_ID'));
    const contractAddress = requireEnvironment(
      'CHAINPASS_CONTRACT_ADDRESS',
    ) as `0x${string}`;
    const recipient = privateKeyToAccount(generatePrivateKey()).address;
    const passId = `anvil-integration-${crypto.randomUUID()}`;
    const service = new BlockchainService();

    const first = await service.mintPass(passId, recipient);
    const second = await service.mintPass(passId, recipient);

    expect(first.recovered).toBe(false);
    expect(second).toEqual({ ...first, recovered: true });

    const chain = defineChain({
      id: chainId,
      name: 'Anvil',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    });
    const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
    const tokenId = BigInt(first.tokenId);

    await expect(
      publicClient.readContract({
        address: contractAddress,
        abi: chainPassAbi,
        functionName: 'ownerOf',
        args: [tokenId],
      }),
    ).resolves.toBe(recipient);
    await expect(
      publicClient.readContract({
        address: contractAddress,
        abi: chainPassAbi,
        functionName: 'tokenIdByPassHash',
        args: [createPassHash(passId)],
      }),
    ).resolves.toBe(tokenId);
  });
});

function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for blockchain integration`);
  return value;
}
