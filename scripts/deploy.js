// Deploys TrustLance and exports its address + ABI for the frontend.
// Usage: npx hardhat run scripts/deploy.js --network localhost
import { network, artifacts } from "hardhat";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUTPUT = resolve(dirname(fileURLToPath(import.meta.url)), "../frontend/src/contract.json");

// Connects to the network given with --network (localhost = `npx hardhat node`).
const { ethers } = await network.create();
const [deployer] = await ethers.getSigners();
const { chainId } = await ethers.provider.getNetwork();

console.log(`Deploying TrustLance with ${deployer.address} (chainId ${chainId})...`);

const trustLance = await ethers.deployContract("TrustLance");
await trustLance.waitForDeployment();
const address = await trustLance.getAddress();
const deployBlock = (await trustLance.deploymentTransaction().wait()).blockNumber;

// The ABI comes from the compiled artifact.
const { abi } = await artifacts.readArtifact("TrustLance");

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(
  OUTPUT,
  JSON.stringify({ address, chainId: Number(chainId), arbiter: deployer.address, deployBlock, abi }, null, 2),
);

console.log(`TrustLance deployed at ${address} (block ${deployBlock})`);
console.log(`Arbiter: ${deployer.address}`);
console.log(`Address + ABI written to ${OUTPUT}`);
