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

Start Anvil, then deploy from its first unlocked development account:

```bash
anvil
DEPLOYER_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  forge script script/DeployChainPass.s.sol:DeployChainPass \
  --rpc-url http://127.0.0.1:8545 \
  --sender "$DEPLOYER_ADDRESS" \
  --unlocked \
  --broadcast
```

## Ethereum Sepolia

The deployment script never reads or hardcodes a private key. Ethereum Sepolia
deployments use Foundry's encrypted `chainpass-deployer` keystore; Forge prompts
for its password without exposing it in the command or environment:

```bash
SEPOLIA_RPC_URL=<rpc-url> \
DEPLOYER_ADDRESS=0xECd97d9A3fee1a726B48fd6E2635949E40C097aC \
  forge script script/DeployChainPass.s.sol:DeployChainPass \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --account chainpass-deployer \
  --sender "$DEPLOYER_ADDRESS" \
  --broadcast
```

Ethereum Sepolia uses chain ID `11155111`. Supply the RPC URL through the
environment; `https://ethereum-sepolia-rpc.publicnode.com` is only an optional
public development example.

### Current deployment

- Contract: [`0xbA3e9bCbe448E928c5e71f4bE6415E7e0e3E5ABb`](https://sepolia.etherscan.io/address/0xbA3e9bCbe448E928c5e71f4bE6415E7e0e3E5ABb)
- Deployer / owner: `0xECd97d9A3fee1a726B48fd6E2635949E40C097aC`
- Deployment transaction: [`0xe43b47ae236313afc9052b3f47aaaf73a2b2a189aef2742d57f433136189641d`](https://sepolia.etherscan.io/tx/0xe43b47ae236313afc9052b3f47aaaf73a2b2a189aef2742d57f433136189641d)
- Deployment block: `11813391`
- Source verification: Sourcify `exact_match`

Token `#1` is the permanent deployment smoke-test token. It was minted to the
deployer from the test-only label
`chainpass-sepolia-deployment-smoke-20260930T081336Z`; it is not a business Pass.
The mint transaction is
[`0x893322f054cd9999a7f656e57a76435a7ae5d2aa9fc0d063de6a02819a0006ee`](https://sepolia.etherscan.io/tx/0x893322f054cd9999a7f656e57a76435a7ae5d2aa9fc0d063de6a02819a0006ee).
The complete public record is versioned in
[`deployments/sepolia.json`](./deployments/sepolia.json).

Do not commit private keys, RPC credentials, broadcast artifacts, or local
Foundry build output.
