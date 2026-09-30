import {
  ConflictException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CHAINPASS_SEPOLIA_CHAIN_ID,
  canonicalizeEvmAddress,
  chainPassAbi,
  createPassHash,
  type Address,
  type Hash,
  type Hex,
} from '@chainpass/web3';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEventLogs,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

export interface OnChainMintResult {
  chainId: number;
  contractAddress: Address;
  recovered: boolean;
  tokenId: string;
  transactionHash: Hash;
}

export interface VerifyTokenOwnerInput {
  chainId: number;
  contractAddress: string;
  tokenId: string;
  expectedOwner: string;
}

@Injectable()
export class BlockchainService {
  isConfigured(): boolean {
    return Boolean(
      process.env.CHAIN_RPC_URL &&
      process.env.CHAIN_ID &&
      process.env.CHAINPASS_CONTRACT_ADDRESS &&
      process.env.DEPLOYER_PRIVATE_KEY,
    );
  }

  async mintPass(
    passId: string,
    recipient: string,
  ): Promise<OnChainMintResult> {
    try {
      return await this.executeMint(passId, recipient);
    } catch (error) {
      if (error instanceof HttpException) throw error;

      throw new ServiceUnavailableException({
        code: 'BLOCKCHAIN_TRANSACTION_UNAVAILABLE',
        message: 'The blockchain transaction could not be completed',
      });
    }
  }

  async verifyTokenOwner(input: VerifyTokenOwnerInput): Promise<boolean> {
    try {
      const config = this.getReadConfig();
      const contractAddress = canonicalizeEvmAddress(input.contractAddress);

      if (
        input.chainId !== config.chainId ||
        contractAddress !== config.contractAddress
      ) {
        return false;
      }

      const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
      });
      const owner = await publicClient.readContract({
        address: contractAddress,
        abi: chainPassAbi,
        functionName: 'ownerOf',
        args: [BigInt(input.tokenId)],
      });

      return (
        canonicalizeEvmAddress(owner) ===
        canonicalizeEvmAddress(input.expectedOwner)
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;

      throw new ServiceUnavailableException({
        code: 'BLOCKCHAIN_VERIFICATION_UNAVAILABLE',
        message: 'The on-chain pass owner could not be verified',
      });
    }
  }

  private async executeMint(
    passId: string,
    recipient: string,
  ): Promise<OnChainMintResult> {
    const config = this.getConfig();
    const recipientAddress = canonicalizeEvmAddress(recipient);
    const passHash = createPassHash(passId);
    const publicClient = createPublicClient({
      chain: config.chain,
      transport: http(config.rpcUrl),
    });

    const existingTokenId = await publicClient.readContract({
      address: config.contractAddress,
      abi: chainPassAbi,
      functionName: 'tokenIdByPassHash',
      args: [passHash],
    });

    if (existingTokenId > 0n) {
      const owner = await publicClient.readContract({
        address: config.contractAddress,
        abi: chainPassAbi,
        functionName: 'ownerOf',
        args: [existingTokenId],
      });

      if (canonicalizeEvmAddress(owner) !== recipientAddress) {
        throw new ConflictException({
          code: 'PASS_ON_CHAIN_OWNER_MISMATCH',
          message: 'The existing on-chain pass belongs to another wallet',
        });
      }

      const logs = await publicClient.getContractEvents({
        address: config.contractAddress,
        abi: chainPassAbi,
        eventName: 'PassMinted',
        args: { passHash },
        fromBlock: 0n,
        toBlock: 'latest',
        strict: true,
      });
      const transactionHash = logs.at(-1)?.transactionHash;

      if (!transactionHash) {
        throw new ServiceUnavailableException({
          code: 'MINT_RECEIPT_NOT_FOUND',
          message:
            'The on-chain mint exists but its receipt could not be found',
        });
      }

      return {
        chainId: config.chainId,
        contractAddress: config.contractAddress,
        recovered: true,
        tokenId: existingTokenId.toString(),
        transactionHash,
      };
    }

    const account = privateKeyToAccount(config.privateKey);
    const walletClient = createWalletClient({
      account,
      chain: config.chain,
      transport: http(config.rpcUrl),
    });
    const simulation = await publicClient.simulateContract({
      account,
      address: config.contractAddress,
      abi: chainPassAbi,
      functionName: 'mintPass',
      args: [recipientAddress, passHash],
    });
    const transactionHash = await walletClient.writeContract(
      simulation.request,
    );
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: transactionHash,
      confirmations: 1,
    });

    if (receipt.status !== 'success') {
      throw new ServiceUnavailableException({
        code: 'MINT_TRANSACTION_FAILED',
        message: 'The mint transaction failed',
      });
    }

    const mintEvents = parseEventLogs({
      abi: chainPassAbi,
      eventName: 'PassMinted',
      logs: receipt.logs,
      strict: true,
    });
    const tokenId = mintEvents[0]?.args.tokenId;

    if (tokenId === undefined) {
      throw new ServiceUnavailableException({
        code: 'MINT_EVENT_NOT_FOUND',
        message: 'The mint transaction did not emit PassMinted',
      });
    }

    const owner = await publicClient.readContract({
      address: config.contractAddress,
      abi: chainPassAbi,
      functionName: 'ownerOf',
      args: [tokenId],
    });

    if (canonicalizeEvmAddress(owner) !== recipientAddress) {
      throw new ServiceUnavailableException({
        code: 'MINT_OWNER_VERIFICATION_FAILED',
        message: 'The minted token owner could not be verified',
      });
    }

    return {
      chainId: config.chainId,
      contractAddress: config.contractAddress,
      recovered: false,
      tokenId: tokenId.toString(),
      transactionHash,
    };
  }

  private getConfig() {
    const readConfig = this.getReadConfig();
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

    if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
      throw new ServiceUnavailableException({
        code: 'BLOCKCHAIN_NOT_CONFIGURED',
        message: 'Blockchain minting is not configured',
      });
    }

    return {
      ...readConfig,
      privateKey: privateKey as Hex,
    };
  }

  private getReadConfig() {
    const rpcUrl = process.env.CHAIN_RPC_URL;
    const chainId = Number(process.env.CHAIN_ID);
    const contractAddressInput = process.env.CHAINPASS_CONTRACT_ADDRESS;

    if (
      !rpcUrl ||
      !Number.isSafeInteger(chainId) ||
      chainId <= 0 ||
      !contractAddressInput
    ) {
      throw new ServiceUnavailableException({
        code: 'BLOCKCHAIN_NOT_CONFIGURED',
        message: 'Blockchain minting is not configured',
      });
    }

    let contractAddress: Address;
    try {
      contractAddress = canonicalizeEvmAddress(contractAddressInput);
    } catch {
      throw new ServiceUnavailableException({
        code: 'BLOCKCHAIN_NOT_CONFIGURED',
        message: 'Blockchain contract address is invalid',
      });
    }

    return {
      chainId,
      contractAddress,
      rpcUrl,
      chain:
        chainId === CHAINPASS_SEPOLIA_CHAIN_ID
          ? sepolia
          : defineChain({
              id: chainId,
              name: `Local EVM ${chainId}`,
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: { default: { http: [rpcUrl] } },
            }),
    };
  }
}
