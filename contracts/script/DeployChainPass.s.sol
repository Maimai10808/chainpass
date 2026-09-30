// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";

import {ChainPass} from "../src/ChainPass.sol";

contract DeployChainPass is Script {
    function run() external returns (ChainPass chainPass) {
        address issuer = vm.envAddress("DEPLOYER_ADDRESS");

        vm.startBroadcast();
        chainPass = new ChainPass(issuer);
        vm.stopBroadcast();

        console2.log("ChainPass deployed at", address(chainPass));
        console2.log("Issuer", issuer);
    }
}
