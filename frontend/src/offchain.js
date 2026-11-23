// Off-chain storage.
// The blockchain only keeps keccak256 fingerprints (32 bytes). The real texts
// live here, in the browser's localStorage, indexed by their hash. Anyone can
// prove a text matches the mission by re-hashing it and comparing.
import { ethers } from "ethers";

const KEY = "lockpay.offchain.v1";

/** keccak256 of a UTF-8 text (same as ethers.id / Solidity keccak256(bytes(text))). */
export function hashText(text) {
  return ethers.keccak256(ethers.toUtf8Bytes(text));
}

/** keccak256 of the raw bytes of a file. */
export async function hashFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return ethers.keccak256(bytes);
}

// localStorage can throw (private window, blocked storage): never crash on it.
function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

function save(store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* storage unavailable: texts simply won't survive a reload */
  }
}

/** Stores a description (or a text deliverable) under its hash. */
export function saveText(hash, text) {
  const store = load();
  store[hash] = text;
  save(store);
}

/** Returns the text stored for this hash, or null. */
export function getText(hash) {
  return load()[hash] ?? null;
}

/** Remembers the name/size of a delivered file (the file itself stays with the freelancer). */
export function saveFileMeta(hash, file) {
  saveText(`file:${hash}`, JSON.stringify({ name: file.name, size: file.size }));
}

/** Returns { name, size } for a delivered file hash, or null. */
export function getFileMeta(hash) {
  try {
    return JSON.parse(getText(`file:${hash}`));
  } catch {
    return null;
  }
}

/** Imports the descriptions written by scripts/seed.js (if it was run). */
export async function importSeed() {
  try {
    const res = await fetch("/offchain-seed.json", { cache: "no-store" });
    if (!res.ok) return;
    const seed = await res.json();
    save({ ...load(), ...seed });
  } catch {
    /* no seed file: nothing to import */
  }
}
