// Hardhat 3 configuration for LockPay.
// The toolbox bundles ethers v6, mocha + chai matchers and the network helpers.
import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],

  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },

  // "localhost" (http://127.0.0.1:8545, chainId 31337) is provided by default:
  // it points to the node started with `npx hardhat node`.
  networks: {
    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
  },
});
