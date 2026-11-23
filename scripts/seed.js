// Creates demo missions with the Hardhat test accounts.
// Usage (after deploy): npx hardhat run scripts/seed.js --network localhost
//
// Accounts: #0 = arbiter, #1 = client, #2 = freelancer.
// The full descriptions are off-chain: they are written to
// frontend/public/offchain-seed.json (hash -> text) and loaded by the frontend,
// which re-hashes them to prove they match the on-chain descriptionHash.
import { network } from "hardhat";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { address, abi } = JSON.parse(readFileSync(resolve(root, "frontend/src/contract.json"), "utf8"));

const { ethers } = await network.create();
const [, client, freelancer] = await ethers.getSigners();
const trustLance = new ethers.Contract(address, abi, ethers.provider);

const DAY = 24 * 60 * 60;
const now = (await ethers.provider.getBlock("latest")).timestamp;

const missions = [
  {
    title: "Site vitrine du club robotique",
    description:
      "Réaliser un site statique (HTML/CSS) de 3 pages pour le club robotique : accueil, projets, contact. " +
      "Responsive, hébergeable sur GitHub Pages. Livrable : lien du dépôt + archive zip.",
    eth: "0.5",
    deadline: now + 10 * DAY,
  },
  {
    title: "Affiche pour la journée portes ouvertes",
    description:
      "Créer une affiche A3 et une déclinaison pour Instagram (1080x1080) pour la JPO de l'école. " +
      "Charte : bleu nuit + blanc, logo fourni. Livrable : fichiers PDF et PNG.",
    eth: "0.2",
    deadline: now + 5 * DAY,
  },
];

const offchain = {};
for (const m of missions) {
  const descriptionHash = ethers.id(m.description); // keccak256(utf8 bytes)
  offchain[descriptionHash] = m.description;
  const tx = await trustLance
    .connect(client)
    .createMission(m.title, descriptionHash, m.deadline, { value: ethers.parseEther(m.eth) });
  await tx.wait();
  console.log(`Created "${m.title}" (${m.eth} ETH)`);
}

// Mission #2 is accepted by the freelancer so the demo starts with two states.
const count = await trustLance.missionCount();
await (await trustLance.connect(freelancer).acceptMission(count)).wait();
console.log(`Mission #${count} accepted by ${freelancer.address}`);

writeFileSync(resolve(root, "frontend/public/offchain-seed.json"), JSON.stringify(offchain, null, 2));
console.log("Off-chain descriptions written to frontend/public/offchain-seed.json");
