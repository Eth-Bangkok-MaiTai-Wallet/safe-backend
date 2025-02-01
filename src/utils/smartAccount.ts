import { getContractABI } from "./etherscan.js";

import { parseEventLogs } from "viem";

import { Hex } from "viem";

import { http } from "viem";

import { privateKeyToAccount } from "viem/accounts";

import { createWalletClient } from "viem";

export async function parseUserOpLogs(receipt, pimlicoClient) {
    const uniqueAddresses = new Set<string>();

    receipt.receipt.logs.forEach((log) => {
      uniqueAddresses.add(log.address);
    });

    const abiMap: Record<string, any[]> = {};

    for (const contractAddress of uniqueAddresses) {
      try {
        const abi = await getContractABI(contractAddress);
        abiMap[contractAddress] = abi;
      } catch (error) {
        console.error('Error fetching ABI for Contract', contractAddress);
        console.error(error);
      }
    }

    receipt.receipt.logs.forEach((log) => {
      const contractAddress = log.address;
      const contractAbi = abiMap[contractAddress];

      if (contractAbi) {
        try {
          const parsedLogs = parseEventLogs({
            abi: contractAbi,
            logs: [log],
          });

          console.log('Parsed Logs for Contract', contractAddress);
          console.log(parsedLogs);
        } catch (error) {
          console.error('Error parsing logs for Contract', contractAddress);
          console.error(error);
        }
      } else {
        console.warn('No ABI found for Contract', contractAddress);
      }
    });
  }

  export async function fundSafe(publicClient, smartAccountClient, pk: Hex) {
    const walletClient = createWalletClient({
      account: privateKeyToAccount(pk),
      chain: publicClient.chain,
      transport: http(publicClient.transport.url),
    });

    const tx = await walletClient.sendTransaction({
      to: smartAccountClient.account!.address,
      value: BigInt(0.01 * 10**18),
      data: "0x",
      chain: publicClient.chain,
    })

    const receiptTx = await publicClient.waitForTransactionReceipt({
      hash: tx,
    })

    return receiptTx;
  }