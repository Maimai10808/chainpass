// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ChainPass is ERC721, Ownable {
    error InvalidPassHash();
    error InvalidRecipient();
    error PassAlreadyMinted(bytes32 passHash);
    error TransfersDisabled();

    uint256 public nextTokenId = 1;

    mapping(bytes32 => uint256) public tokenIdByPassHash;

    event PassMinted(bytes32 indexed passHash, uint256 indexed tokenId, address indexed owner);

    constructor(address initialOwner) ERC721("ChainPass", "CPASS") Ownable(initialOwner) {}

    function mintPass(address to, bytes32 passHash) external onlyOwner returns (uint256 tokenId) {
        if (to == address(0)) revert InvalidRecipient();
        if (passHash == bytes32(0)) revert InvalidPassHash();
        if (tokenIdByPassHash[passHash] != 0) {
            revert PassAlreadyMinted(passHash);
        }

        tokenId = nextTokenId++;
        tokenIdByPassHash[passHash] = tokenId;

        _safeMint(to, tokenId);

        emit PassMinted(passHash, tokenId, to);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert TransfersDisabled();
        }

        return super._update(to, tokenId, auth);
    }
}
