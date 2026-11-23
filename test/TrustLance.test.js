// Tests for TrustLance (Hardhat 3 + mocha + chai matchers).
// Run with: npx hardhat test
import { expect } from "chai";
import { network } from "hardhat";

// One in-process Hardhat network for the whole file.
const { ethers, networkHelpers } = await network.create();
const { time, loadFixture } = networkHelpers;

// Status enum values, in the same order as in the contract.
const Status = { Open: 0n, Accepted: 1n, Delivered: 2n, Completed: 3n, Cancelled: 4n, Disputed: 5n, Resolved: 6n };

const AMOUNT = ethers.parseEther("1");
const THREE_DAYS = 3 * 24 * 60 * 60;
const ONE_WEEK = 7 * 24 * 60 * 60;
const DESCRIPTION_HASH = ethers.id("Build a landing page for the student club");
const DELIVERABLE_HASH = ethers.id("https://github.com/student/landing-page @ commit 1a2b3c");

describe("TrustLance", function () {
  // ---------------------------------------------------------------------
  // Fixtures (loadFixture snapshots the chain, so each test starts clean)
  // ---------------------------------------------------------------------

  /** Deploys the contract. Account 0 = arbiter, 1 = client, 2 = freelancer, 3 = stranger. */
  async function deployFixture() {
    const [arbiter, client, freelancer, stranger] = await ethers.getSigners();
    const trustLance = await ethers.deployContract("TrustLance", [], arbiter);
    return { trustLance, arbiter, client, freelancer, stranger };
  }

  /** Deploy + one Open mission (id 1) created by the client. */
  async function openMissionFixture() {
    const ctx = await deployFixture();
    const deadline = (await time.latest()) + ONE_WEEK;
    await ctx.trustLance
      .connect(ctx.client)
      .createMission("Landing page", DESCRIPTION_HASH, deadline, { value: AMOUNT });
    return { ...ctx, id: 1n, deadline };
  }

  /** Mission accepted by the freelancer. */
  async function acceptedMissionFixture() {
    const ctx = await openMissionFixture();
    await ctx.trustLance.connect(ctx.freelancer).acceptMission(ctx.id);
    return ctx;
  }

  /** Mission delivered by the freelancer. */
  async function deliveredMissionFixture() {
    const ctx = await acceptedMissionFixture();
    await ctx.trustLance.connect(ctx.freelancer).deliverWork(ctx.id, DELIVERABLE_HASH);
    return ctx;
  }

  /** Mission in dispute (opened by the client). */
  async function disputedMissionFixture() {
    const ctx = await deliveredMissionFixture();
    await ctx.trustLance.connect(ctx.client).openDispute(ctx.id);
    return ctx;
  }

  // ---------------------------------------------------------------------
  // Deployment
  // ---------------------------------------------------------------------

  describe("Deployment", function () {
    it("sets the deployer as arbiter and starts with no mission", async function () {
      const { trustLance, arbiter } = await loadFixture(deployFixture);
      expect(await trustLance.arbiter()).to.equal(arbiter.address);
      expect(await trustLance.missionCount()).to.equal(0n);
      expect(await trustLance.REVIEW_PERIOD()).to.equal(BigInt(THREE_DAYS));
    });
  });

  // ---------------------------------------------------------------------
  // Happy paths
  // ---------------------------------------------------------------------

  describe("Happy path: create -> accept -> deliver -> approve", function () {
    it("runs the full flow, moves the funds and emits every event", async function () {
      const { trustLance, client, freelancer } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + ONE_WEEK;
      const address = await trustLance.getAddress();

      // 1. Create: the client's ETH moves into the contract
      await expect(
        trustLance.connect(client).createMission("Landing page", DESCRIPTION_HASH, deadline, { value: AMOUNT }),
      )
        .to.emit(trustLance, "MissionCreated")
        .withArgs(1n, client.address, AMOUNT, "Landing page", deadline);
      expect(await ethers.provider.getBalance(address)).to.equal(AMOUNT);
      expect(await trustLance.missionCount()).to.equal(1n);

      // 2. Accept
      await expect(trustLance.connect(freelancer).acceptMission(1n))
        .to.emit(trustLance, "MissionAccepted")
        .withArgs(1n, freelancer.address);

      // 3. Deliver (only the hash goes on-chain)
      await expect(trustLance.connect(freelancer).deliverWork(1n, DELIVERABLE_HASH))
        .to.emit(trustLance, "WorkDelivered")
        .withArgs(1n, freelancer.address, DELIVERABLE_HASH);

      // 4. Approve: contract -> freelancer
      const tx = trustLance.connect(client).approveWork(1n);
      await expect(tx).to.emit(trustLance, "PaymentReleased").withArgs(1n, freelancer.address, AMOUNT, false);
      await expect(tx).to.changeEtherBalances(ethers, [trustLance, freelancer], [-AMOUNT, AMOUNT]);

      // Final state
      const m = await trustLance.getMission(1n);
      expect(m.status).to.equal(Status.Completed);
      expect(m.client).to.equal(client.address);
      expect(m.freelancer).to.equal(freelancer.address);
      expect(m.descriptionHash).to.equal(DESCRIPTION_HASH);
      expect(m.deliverableHash).to.equal(DELIVERABLE_HASH);
      expect(m.deliveredAt).to.be.greaterThan(0n);
      expect(await ethers.provider.getBalance(address)).to.equal(0n);
    });
  });

  describe("Cancel and refund", function () {
    it("refunds the client when an Open mission is cancelled", async function () {
      const { trustLance, client, id } = await loadFixture(openMissionFixture);

      const tx = trustLance.connect(client).cancelMission(id);
      await expect(tx).to.emit(trustLance, "MissionCancelled").withArgs(id, client.address, AMOUNT);
      await expect(tx).to.changeEtherBalances(ethers, [trustLance, client], [-AMOUNT, AMOUNT]);

      expect((await trustLance.getMission(id)).status).to.equal(Status.Cancelled);
    });

    it("REJECTS cancelling once a freelancer accepted", async function () {
      const { trustLance, client, id } = await loadFixture(acceptedMissionFixture);
      await expect(trustLance.connect(client).cancelMission(id)).to.be.revertedWith("Invalid state");
    });

    it("REJECTS a stranger cancelling the mission", async function () {
      const { trustLance, stranger, id } = await loadFixture(openMissionFixture);
      await expect(trustLance.connect(stranger).cancelMission(id)).to.be.revertedWith("Only client");
    });
  });

  describe("Auto-claim after the review period", function () {
    it("lets the freelancer claim once 3 days passed without an answer", async function () {
      const { trustLance, freelancer, id } = await loadFixture(deliveredMissionFixture);

      await time.increase(THREE_DAYS); // the client stays silent

      const tx = trustLance.connect(freelancer).claimPayment(id);
      await expect(tx).to.emit(trustLance, "PaymentReleased").withArgs(id, freelancer.address, AMOUNT, true);
      await expect(tx).to.changeEtherBalances(ethers, [trustLance, freelancer], [-AMOUNT, AMOUNT]);
      expect((await trustLance.getMission(id)).status).to.equal(Status.Completed);
    });
  });

  describe("Dispute", function () {
    it("can be opened by the freelancer too", async function () {
      const { trustLance, freelancer, id } = await loadFixture(deliveredMissionFixture);
      await expect(trustLance.connect(freelancer).openDispute(id))
        .to.emit(trustLance, "DisputeOpened")
        .withArgs(id, freelancer.address);
    });

    it("is resolved by the arbiter with a 50/50 split", async function () {
      const { trustLance, arbiter, client, freelancer, id } = await loadFixture(deliveredMissionFixture);

      await expect(trustLance.connect(client).openDispute(id))
        .to.emit(trustLance, "DisputeOpened")
        .withArgs(id, client.address);
      expect((await trustLance.getMission(id)).status).to.equal(Status.Disputed);

      const half = AMOUNT / 2n;
      const tx = trustLance.connect(arbiter).resolveDispute(id, 5000);
      await expect(tx).to.emit(trustLance, "DisputeResolved").withArgs(id, 5000n, half, half);
      await expect(tx).to.changeEtherBalances(ethers, [trustLance, freelancer, client], [-AMOUNT, half, half]);
      expect((await trustLance.getMission(id)).status).to.equal(Status.Resolved);
    });

    it("gives everything to one side with 0 or 10000 bps", async function () {
      const { trustLance, arbiter, client, id } = await loadFixture(disputedMissionFixture);
      await expect(trustLance.connect(arbiter).resolveDispute(id, 0)).to.changeEtherBalances(
        ethers,
        [trustLance, client],
        [-AMOUNT, AMOUNT],
      );
    });

    it("REJECTS a share above 10000 bps", async function () {
      const { trustLance, arbiter, id } = await loadFixture(disputedMissionFixture);
      await expect(trustLance.connect(arbiter).resolveDispute(id, 10001)).to.be.revertedWith(
        "Share must be <= 10000 bps",
      );
    });

    it("REJECTS a stranger opening a dispute", async function () {
      const { trustLance, stranger, id } = await loadFixture(deliveredMissionFixture);
      await expect(trustLance.connect(stranger).openDispute(id)).to.be.revertedWith("Only client or freelancer");
    });
  });

  // ---------------------------------------------------------------------
  // Rejected scenarios required by the specification
  // ---------------------------------------------------------------------

  describe("Rejections", function () {
    it("REJECTS a mission with a zero amount", async function () {
      const { trustLance, client } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + ONE_WEEK;
      await expect(
        trustLance.connect(client).createMission("Free work", DESCRIPTION_HASH, deadline, { value: 0 }),
      ).to.be.revertedWith("Amount must be > 0");
    });

    it("REJECTS a deadline in the past", async function () {
      const { trustLance, client } = await loadFixture(deployFixture);
      const yesterday = (await time.latest()) - 24 * 60 * 60;
      await expect(
        trustLance.connect(client).createMission("Too late", DESCRIPTION_HASH, yesterday, { value: AMOUNT }),
      ).to.be.revertedWith("Deadline must be in the future");
    });

    it("REJECTS the client accepting their own mission", async function () {
      const { trustLance, client, id } = await loadFixture(openMissionFixture);
      await expect(trustLance.connect(client).acceptMission(id)).to.be.revertedWith(
        "Client cannot accept own mission",
      );
    });

    it("REJECTS a stranger delivering the work", async function () {
      const { trustLance, stranger, id } = await loadFixture(acceptedMissionFixture);
      await expect(trustLance.connect(stranger).deliverWork(id, DELIVERABLE_HASH)).to.be.revertedWith(
        "Only freelancer",
      );
    });

    it("REJECTS a delivery after the deadline", async function () {
      const { trustLance, freelancer, id, deadline } = await loadFixture(acceptedMissionFixture);
      await time.increaseTo(deadline + 1);
      await expect(trustLance.connect(freelancer).deliverWork(id, DELIVERABLE_HASH)).to.be.revertedWith(
        "Deadline passed",
      );
    });

    it("REJECTS an empty deliverable hash", async function () {
      const { trustLance, freelancer, id } = await loadFixture(acceptedMissionFixture);
      await expect(trustLance.connect(freelancer).deliverWork(id, ethers.ZeroHash)).to.be.revertedWith(
        "Empty deliverable hash",
      );
    });

    it("REJECTS a stranger approving the work", async function () {
      const { trustLance, stranger, id } = await loadFixture(deliveredMissionFixture);
      await expect(trustLance.connect(stranger).approveWork(id)).to.be.revertedWith("Only client");
    });

    it("REJECTS a claim before the review period is over", async function () {
      const { trustLance, freelancer, id } = await loadFixture(deliveredMissionFixture);
      await time.increase(THREE_DAYS - 60); // one minute too early
      await expect(trustLance.connect(freelancer).claimPayment(id)).to.be.revertedWith("Review period not over");
    });

    it("REJECTS a non-arbiter resolving a dispute", async function () {
      const { trustLance, client, id } = await loadFixture(disputedMissionFixture);
      await expect(trustLance.connect(client).resolveDispute(id, 10000)).to.be.revertedWith("Only arbiter");
    });

    it("REJECTS paying twice (approve twice, or approve then claim)", async function () {
      const { trustLance, client, freelancer, id } = await loadFixture(deliveredMissionFixture);
      await trustLance.connect(client).approveWork(id);

      await expect(trustLance.connect(client).approveWork(id)).to.be.revertedWith("Invalid state");

      await time.increase(THREE_DAYS);
      await expect(trustLance.connect(freelancer).claimPayment(id)).to.be.revertedWith("Invalid state");
    });

    it("REJECTS resolving the same dispute twice", async function () {
      const { trustLance, arbiter, id } = await loadFixture(disputedMissionFixture);
      await trustLance.connect(arbiter).resolveDispute(id, 5000);
      await expect(trustLance.connect(arbiter).resolveDispute(id, 5000)).to.be.revertedWith("Invalid state");
    });

    it("REJECTS actions on a mission that does not exist", async function () {
      const { trustLance, freelancer } = await loadFixture(deployFixture);
      await expect(trustLance.connect(freelancer).acceptMission(42n)).to.be.revertedWith("Mission not found");
      await expect(trustLance.getMission(0n)).to.be.revertedWith("Mission not found");
    });
  });
});
