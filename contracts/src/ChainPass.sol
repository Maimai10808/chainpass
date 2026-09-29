// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract ChainPass is ERC721 {
    struct EventInfo {
        address organizer;
        string name;
        uint256 maxSupply;
        uint256 minted;
        bool active;
    }

    uint256 public nextEventId = 1;
    uint256 public nextTokenId = 1;

    mapping(uint256 => EventInfo) public events;
    mapping(uint256 => uint256) public tokenEvent;
    mapping(uint256 => bool) public checkedIn;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    event EventCreated(
        uint256 indexed eventId,
        address indexed organizer,
        string name,
        uint256 maxSupply
    );

    event PassClaimed(
        uint256 indexed eventId,
        uint256 indexed tokenId,
        address indexed owner
    );

    event PassCheckedIn(
        uint256 indexed eventId,
        uint256 indexed tokenId,
        address indexed owner
    );

    constructor() ERC721("ChainPass", "CPASS") {}

    function createEvent(
        string calldata name,
        uint256 maxSupply
    ) external returns (uint256 eventId) {
        require(bytes(name).length > 0, "Event name required");
        require(maxSupply > 0, "Supply must be greater than zero");

        eventId = nextEventId++;

        events[eventId] = EventInfo({
            organizer: msg.sender,
            name: name,
            maxSupply: maxSupply,
            minted: 0,
            active: true
        });

        emit EventCreated(eventId, msg.sender, name, maxSupply);
    }

    function claimPass(
        uint256 eventId
    ) external returns (uint256 tokenId) {
        EventInfo storage eventInfo = events[eventId];

        require(eventInfo.organizer != address(0), "Event not found");
        require(eventInfo.active, "Event is not active");
        require(eventInfo.minted < eventInfo.maxSupply, "Sold out");
        require(!hasClaimed[eventId][msg.sender], "Already claimed");

        tokenId = nextTokenId++;

        eventInfo.minted++;
        hasClaimed[eventId][msg.sender] = true;
        tokenEvent[tokenId] = eventId;

        _safeMint(msg.sender, tokenId);

        emit PassClaimed(eventId, tokenId, msg.sender);
    }

    function checkIn(uint256 tokenId) external {
        address passOwner = ownerOf(tokenId);
        uint256 eventId = tokenEvent[tokenId];
        EventInfo storage eventInfo = events[eventId];

        require(msg.sender == eventInfo.organizer, "Not event organizer");
        require(!checkedIn[tokenId], "Already checked in");

        checkedIn[tokenId] = true;

        emit PassCheckedIn(eventId, tokenId, passOwner);
    }
}
