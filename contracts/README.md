# ChainPass Contracts

Foundry project for the ChainPass non-transferable ERC-721 pass contract.

`ChainPass.sol` permits only the contract owner (the platform issuer) to call
`mintPass(address, bytes32)`. The `passHash` is the keccak256 hash of the
database Pass ID, and `tokenIdByPassHash` prevents a database Pass from being
minted twice. Transfers are disabled for the MVP so database and on-chain
ownership cannot silently diverge.

## Verify

```bash
forge fmt --check
forge build
forge test
```

After a successful build, sync the compiled ABI from the monorepo root:

```bash
pnpm web3:sync-abi
```

## Local deployment

Start Anvil, then deploy with an ephemeral development key supplied through the
environment:

```bash
anvil
DEPLOYER_PRIVATE_KEY=<anvil-private-key> \
  forge script script/DeployChainPass.s.sol:DeployChainPass \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast
```

## Base Sepolia

The deployment script never hardcodes a private key. A Base Sepolia broadcast
requires a funded issuer and developer-provided secrets:

```bash
BASE_SEPOLIA_RPC_URL=<rpc-url> \
DEPLOYER_PRIVATE_KEY=<issuer-private-key> \
  forge script script/DeployChainPass.s.sol:DeployChainPass \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
  --broadcast
```

Do not commit private keys, RPC credentials, broadcast artifacts, or local
Foundry build output.
