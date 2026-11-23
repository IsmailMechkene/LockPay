// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title  TrustLance - escrow for student freelance missions
/// @author IGL4 Blockchain project
/// @notice A client locks ETH for a mission. A freelancer accepts it, delivers
///         the work (only its hash is stored on-chain) and is paid when the
///         client approves. In case of disagreement, the arbiter splits the funds.
/// @dev    Every function that sends ETH follows checks-effects-interactions:
///         the status is updated BEFORE the transfer, and `nonReentrant` blocks
///         re-entry. A mission can therefore never be paid twice.
contract TrustLance is ReentrancyGuard {
    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    /// @notice Life cycle of a mission (see the state diagram in the README).
    enum Status {
        Open,       // 0 - created, funds locked, waiting for a freelancer
        Accepted,   // 1 - a freelancer is working on it
        Delivered,  // 2 - the deliverable hash was submitted
        Completed,  // 3 - freelancer paid (approval or auto-claim)
        Cancelled,  // 4 - cancelled by the client, refunded
        Disputed,   // 5 - waiting for the arbiter
        Resolved    // 6 - dispute settled by the arbiter
    }

    /// @notice A mission. Only hashes are stored: texts and files stay off-chain.
    struct Mission {
        uint256 id;
        address client;
        address freelancer;      // address(0) until someone accepts
        uint256 amount;          // escrowed amount, in wei
        string title;
        bytes32 descriptionHash; // keccak256 of the full description (off-chain)
        bytes32 deliverableHash; // keccak256 of the delivered file / text
        uint256 deadline;        // unix timestamp, last moment to deliver
        uint256 deliveredAt;     // unix timestamp of the delivery
        Status status;
    }

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    /// @notice Time the client has to review a delivery before the
    ///         freelancer can claim the payment alone.
    uint256 public constant REVIEW_PERIOD = 3 days;

    /// @notice 100 % expressed in basis points (1 bp = 0.01 %).
    uint256 public constant MAX_BPS = 10_000;

    /// @notice Trusted third party that settles disputes (the deployer).
    address public immutable arbiter;

    /// @notice Number of missions created. Ids go from 1 to missionCount.
    uint256 public missionCount;

    mapping(uint256 => Mission) private missions;

    // ---------------------------------------------------------------------
    // Events (listened to by the frontend's live log)
    // ---------------------------------------------------------------------

    event MissionCreated(uint256 indexed id, address indexed client, uint256 amount, string title, uint256 deadline);
    event MissionCancelled(uint256 indexed id, address indexed client, uint256 refund);
    event MissionAccepted(uint256 indexed id, address indexed freelancer);
    event WorkDelivered(uint256 indexed id, address indexed freelancer, bytes32 deliverableHash);
    event PaymentReleased(uint256 indexed id, address indexed freelancer, uint256 amount, bool autoClaimed);
    event DisputeOpened(uint256 indexed id, address indexed openedBy);
    event DisputeResolved(uint256 indexed id, uint256 freelancerShareBps, uint256 freelancerAmount, uint256 clientAmount);

    // ---------------------------------------------------------------------
    // Modifiers (role and state checks)
    // ---------------------------------------------------------------------

    /// @dev The mission id must exist.
    modifier missionExists(uint256 id) {
        require(id > 0 && id <= missionCount, "Mission not found");
        _;
    }

    /// @dev Caller must be the client of the mission.
    modifier onlyClient(uint256 id) {
        require(msg.sender == missions[id].client, "Only client");
        _;
    }

    /// @dev Caller must be the freelancer assigned to the mission.
    modifier onlyFreelancer(uint256 id) {
        require(msg.sender == missions[id].freelancer, "Only freelancer");
        _;
    }

    /// @dev Caller must be the client or the freelancer of the mission.
    modifier onlyParties(uint256 id) {
        require(
            msg.sender == missions[id].client || msg.sender == missions[id].freelancer,
            "Only client or freelancer"
        );
        _;
    }

    /// @dev Caller must be the arbiter.
    modifier onlyArbiter() {
        require(msg.sender == arbiter, "Only arbiter");
        _;
    }

    /// @dev The mission must currently be in `expected` status.
    modifier inStatus(uint256 id, Status expected) {
        require(missions[id].status == expected, "Invalid state");
        _;
    }

    // ---------------------------------------------------------------------
    // Constructor
    // ---------------------------------------------------------------------

    /// @notice The account that deploys the contract becomes the arbiter.
    constructor() {
        arbiter = msg.sender;
    }

    // ---------------------------------------------------------------------
    // Client actions
    // ---------------------------------------------------------------------

    /// @notice Create a mission and lock its payment in the contract.
    /// @param title           Short public title of the mission.
    /// @param descriptionHash keccak256 of the full description (kept off-chain).
    /// @param deadline        Unix timestamp before which the work must be delivered.
    /// @return id             Id of the new mission.
    function createMission(string calldata title, bytes32 descriptionHash, uint256 deadline)
        external
        payable
        returns (uint256 id)
    {
        require(msg.value > 0, "Amount must be > 0");
        require(deadline > block.timestamp, "Deadline must be in the future");
        require(bytes(title).length > 0, "Title required");

        id = ++missionCount;
        Mission storage m = missions[id];
        m.id = id;
        m.client = msg.sender;
        m.amount = msg.value;
        m.title = title;
        m.descriptionHash = descriptionHash;
        m.deadline = deadline;
        m.status = Status.Open; // explicit for readability (Open is the default value)

        emit MissionCreated(id, msg.sender, msg.value, title, deadline);
    }

    /// @notice Cancel a mission nobody accepted yet and get the ETH back.
    /// @param id Mission id.
    function cancelMission(uint256 id)
        external
        nonReentrant
        missionExists(id)
        onlyClient(id)
        inStatus(id, Status.Open)
    {
        Mission storage m = missions[id];
        uint256 refund = m.amount;

        m.status = Status.Cancelled;  // effect first...
        _send(m.client, refund);      // ...interaction last

        emit MissionCancelled(id, m.client, refund);
    }

    /// @notice Approve the delivered work: the escrow is paid to the freelancer.
    /// @param id Mission id.
    function approveWork(uint256 id)
        external
        nonReentrant
        missionExists(id)
        onlyClient(id)
        inStatus(id, Status.Delivered)
    {
        _releaseToFreelancer(id, false);
    }

    // ---------------------------------------------------------------------
    // Freelancer actions
    // ---------------------------------------------------------------------

    /// @notice Accept an open mission. The client cannot accept their own mission.
    /// @param id Mission id.
    function acceptMission(uint256 id) external missionExists(id) inStatus(id, Status.Open) {
        Mission storage m = missions[id];
        require(msg.sender != m.client, "Client cannot accept own mission");
        require(block.timestamp <= m.deadline, "Deadline passed");

        m.freelancer = msg.sender;
        m.status = Status.Accepted;

        emit MissionAccepted(id, msg.sender);
    }

    /// @notice Submit the hash of the deliverable before the deadline.
    /// @param id              Mission id.
    /// @param deliverableHash keccak256 of the delivered file or text.
    function deliverWork(uint256 id, bytes32 deliverableHash)
        external
        missionExists(id)
        onlyFreelancer(id)
        inStatus(id, Status.Accepted)
    {
        Mission storage m = missions[id];
        require(block.timestamp <= m.deadline, "Deadline passed");
        require(deliverableHash != bytes32(0), "Empty deliverable hash");

        m.deliverableHash = deliverableHash;
        m.deliveredAt = block.timestamp;
        m.status = Status.Delivered;

        emit WorkDelivered(id, msg.sender, deliverableHash);
    }

    /// @notice If the client stays silent for REVIEW_PERIOD after the delivery,
    ///         the freelancer can release the payment alone.
    /// @param id Mission id.
    function claimPayment(uint256 id)
        external
        nonReentrant
        missionExists(id)
        onlyFreelancer(id)
        inStatus(id, Status.Delivered)
    {
        require(
            block.timestamp >= missions[id].deliveredAt + REVIEW_PERIOD,
            "Review period not over"
        );
        _releaseToFreelancer(id, true);
    }

    // ---------------------------------------------------------------------
    // Disputes
    // ---------------------------------------------------------------------

    /// @notice Client or freelancer contests a delivery. Funds stay locked
    ///         until the arbiter decides.
    /// @param id Mission id.
    function openDispute(uint256 id)
        external
        missionExists(id)
        onlyParties(id)
        inStatus(id, Status.Delivered)
    {
        missions[id].status = Status.Disputed;
        emit DisputeOpened(id, msg.sender);
    }

    /// @notice Arbiter splits the escrow between freelancer and client.
    /// @param id                 Mission id.
    /// @param freelancerShareBps Freelancer's share in basis points
    ///                           (0 = all to client, 5000 = 50/50, 10000 = all to freelancer).
    function resolveDispute(uint256 id, uint256 freelancerShareBps)
        external
        nonReentrant
        missionExists(id)
        onlyArbiter
        inStatus(id, Status.Disputed)
    {
        require(freelancerShareBps <= MAX_BPS, "Share must be <= 10000 bps");

        Mission storage m = missions[id];
        uint256 freelancerAmount = (m.amount * freelancerShareBps) / MAX_BPS;
        uint256 clientAmount = m.amount - freelancerAmount; // no wei lost to rounding

        m.status = Status.Resolved; // effect before the transfers

        if (freelancerAmount > 0) _send(m.freelancer, freelancerAmount);
        if (clientAmount > 0) _send(m.client, clientAmount);

        emit DisputeResolved(id, freelancerShareBps, freelancerAmount, clientAmount);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Read a full mission.
    /// @param id Mission id.
    /// @return The Mission struct.
    function getMission(uint256 id) external view missionExists(id) returns (Mission memory) {
        return missions[id];
    }

    // ---------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------

    /// @dev Marks the mission Completed, then pays the freelancer.
    ///      Callers already checked the role and that status == Delivered.
    function _releaseToFreelancer(uint256 id, bool autoClaimed) private {
        Mission storage m = missions[id];
        m.status = Status.Completed; // effect: a second call now fails with "Invalid state"
        _send(m.freelancer, m.amount);
        emit PaymentReleased(id, m.freelancer, m.amount, autoClaimed);
    }

    /// @dev Sends ETH with `call` (works with smart-contract wallets too).
    function _send(address to, uint256 value) private {
        (bool ok, ) = payable(to).call{value: value}("");
        require(ok, "Transfer failed");
    }
}
