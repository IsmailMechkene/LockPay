// Blockchain layer: read-only provider, MetaMask wallet, transactions, errors.
// Reads go straight to the Hardhat node (fast, works before connecting).
// Writes are signed by MetaMask.
import { ethers } from "ethers";
import { t, hasKey } from "./i18n.js";

// contract.json is written by scripts/deploy.js. import.meta.glob does not
// crash the build when the file is missing (contract not deployed yet).
const files = import.meta.glob("./contract.json", { eager: true, import: "default" });
export const deployment = files["./contract.json"] ?? null;

export const RPC_URL = "http://127.0.0.1:8545";
export const CHAIN_ID = 31337;
export const CHAIN_ID_HEX = "0x7a69"; // 31337

/** Status enum, same order as in LockPay.sol */
export const STATUS = ["Open", "Accepted", "Delivered", "Completed", "Cancelled", "Disputed", "Resolved"];

/** Read-only connection to the local node. */
export const readProvider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID, {
  staticNetwork: true,
  pollingInterval: 1000,
});

export const readContract = deployment
  ? new ethers.Contract(deployment.address, deployment.abi, readProvider)
  : null;

// ---------------------------------------------------------------------------
// Wallet (MetaMask)
// ---------------------------------------------------------------------------

let browserProvider = null;

export function hasMetaMask() {
  return typeof window.ethereum !== "undefined";
}

/** MetaMask provider, created on first use (also after a restored session). */
function wallet() {
  browserProvider ??= new ethers.BrowserProvider(window.ethereum);
  return browserProvider;
}

/** Asks MetaMask for the account. Returns { account, chainId }. */
export async function connectWallet() {
  if (!hasMetaMask()) {
    throw new Error(t("err.noMetaMask"));
  }
  const [account] = await wallet().send("eth_requestAccounts", []);
  const chainId = Number(await wallet().send("eth_chainId", []));
  return { account: ethers.getAddress(account), chainId };
}

/** Adds / switches MetaMask to the Hardhat local network. */
export async function switchToLocalNetwork() {
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID_HEX }] });
  } catch (err) {
    // 4902 = this network is unknown to MetaMask: add it first.
    if (err.code !== 4902) throw err;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: CHAIN_ID_HEX,
        chainName: "Hardhat Local",
        rpcUrls: [RPC_URL],
        nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      }],
    });
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Converts the Solidity struct (a Result) into a plain JS object. */
function toMission(r) {
  return {
    id: Number(r.id),
    client: r.client,
    freelancer: r.freelancer === ethers.ZeroAddress ? null : r.freelancer,
    amount: r.amount,
    title: r.title,
    descriptionHash: r.descriptionHash,
    deliverableHash: r.deliverableHash === ethers.ZeroHash ? null : r.deliverableHash,
    deadline: Number(r.deadline),
    deliveredAt: Number(r.deliveredAt),
    status: STATUS[Number(r.status)],
  };
}

/** Reads every mission (ids 1..missionCount). Newest first. */
export async function fetchMissions() {
  const count = Number(await readContract.missionCount());
  const ids = Array.from({ length: count }, (_, i) => i + 1);
  const missions = await Promise.all(ids.map((id) => readContract.getMission(id).then(toMission)));
  return missions.reverse();
}

/** False when contract.json points to an address with no code, e.g. the node was restarted. */
export async function isContractDeployed() {
  return (await readProvider.getCode(deployment.address)) !== "0x";
}

export async function fetchEscrowBalance() {
  return readProvider.getBalance(deployment.address);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Sends a transaction in two steps:
 *  1. eth_call simulation from the user's address -> if the contract would
 *     revert, we get its exact require() message before MetaMask opens;
 *  2. the real transaction, signed in MetaMask, then wait for the receipt.
 * `onStage` is called with "simulate" | "sign" | "mining".
 */
export async function sendTx(account, method, args, overrides = {}, onStage = () => {}) {
  onStage("simulate");
  await readContract[method].staticCall(...args, { ...overrides, from: account });

  onStage("sign");
  const signer = await wallet().getSigner(account);
  const tx = await readContract.connect(signer)[method](...args, overrides);

  onStage("mining");
  return tx.wait();
}

/** Local demo only: moves the Hardhat node clock forward and mines a block. */
export async function timeTravel(seconds) {
  await readProvider.send("evm_increaseTime", [seconds]);
  await readProvider.send("evm_mine", []);
}

// ---------------------------------------------------------------------------
// Errors -> human readable messages
// ---------------------------------------------------------------------------

/**
 * Turns any ethers / MetaMask error into { title, reason, explanation }.
 * `reason` is the raw require() string when the contract reverted; the
 * translated explanation of each reason lives in i18n.js ("reason.<text>").
 */
export function explainError(err) {
  if (err?.code === "ACTION_REJECTED" || err?.info?.error?.code === 4001 || err?.code === 4001) {
    return { title: t("err.rejectedTitle"), reason: null, explanation: t("err.rejectedText") };
  }

  const reason = err?.reason ?? err?.revert?.args?.[0] ?? null;
  if (reason) {
    return {
      title: t("err.contractTitle"),
      reason,
      explanation: hasKey(`reason.${reason}`) ? t(`reason.${reason}`) : t("err.contractGeneric"),
    };
  }

  if (err?.code === "NETWORK_ERROR" || /ECONNREFUSED|Failed to fetch/i.test(err?.message ?? "")) {
    return { title: t("err.nodeTitle"), reason: null, explanation: t("err.nodeText") };
  }

  if (/nonce/i.test(err?.message ?? "")) {
    return { title: t("err.nonceTitle"), reason: null, explanation: t("err.nonceText") };
  }

  return { title: t("err.generic"), reason: null, explanation: err?.shortMessage ?? err?.message ?? String(err) };
}
