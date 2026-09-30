// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {ChainPass} from "../src/ChainPass.sol";

contract ChainPassTest is Test {
    ChainPass private chainPass;

    address private constant PASS_OWNER = address(0xA11CE);
    address private constant OTHER_USER = address(0xB0B);
    bytes32 private constant PASS_HASH = keccak256("database-pass-1");

    event PassMinted(bytes32 indexed passHash, uint256 indexed tokenId, address indexed owner);

    function setUp() public {
        chainPass = new ChainPass(address(this));
    }

    function testOwnerCanMintPass() public {
        vm.expectEmit(true, true, true, true);
        emit PassMinted(PASS_HASH, 1, PASS_OWNER);

        uint256 tokenId = chainPass.mintPass(PASS_OWNER, PASS_HASH);

        assertEq(tokenId, 1);
        assertEq(chainPass.ownerOf(tokenId), PASS_OWNER);
        assertEq(chainPass.tokenIdByPassHash(PASS_HASH), tokenId);
    }

    function testNonOwnerCannotMintPass() public {
        vm.prank(OTHER_USER);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, OTHER_USER));

        chainPass.mintPass(PASS_OWNER, PASS_HASH);
    }

    function testDuplicateDatabasePassCannotBeMinted() public {
        chainPass.mintPass(PASS_OWNER, PASS_HASH);

        vm.expectRevert(abi.encodeWithSelector(ChainPass.PassAlreadyMinted.selector, PASS_HASH));
        chainPass.mintPass(OTHER_USER, PASS_HASH);
    }

    function testDifferentPassesReceiveDifferentTokenIds() public {
        uint256 firstTokenId = chainPass.mintPass(PASS_OWNER, PASS_HASH);
        uint256 secondTokenId = chainPass.mintPass(OTHER_USER, keccak256("database-pass-2"));

        assertEq(firstTokenId, 1);
        assertEq(secondTokenId, 2);
    }

    function testPassCannotBeTransferred() public {
        uint256 tokenId = chainPass.mintPass(PASS_OWNER, PASS_HASH);

        vm.prank(PASS_OWNER);
        vm.expectRevert(ChainPass.TransfersDisabled.selector);
        chainPass.transferFrom(PASS_OWNER, OTHER_USER, tokenId);
    }
}
