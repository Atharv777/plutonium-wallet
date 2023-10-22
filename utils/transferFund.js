import { ethers } from "ethers";
import { EthersAdapter } from "@safe-global/protocol-kit";
import { OperationType } from "@safe-global/safe-core-sdk-types";
import Safe from "@safe-global/protocol-kit";

async function transferFund(destinationAdd, amount) {
	try {
		const provider = new ethers.providers.JsonRpcProvider(
			process.env.REACT_APP_INFURA_GOERLI_KEY
		);

		// Create a wallet instance using the private key
		const safeOwner = new ethers.Wallet(wallet.privateKey, provider);

		const ethAdapter = new EthersAdapter({
			ethers,
			signerOrProvider: safeOwner,
		});
		const safeSdk = await Safe.create({ ethAdapter, safeAddress });

		const amountToSend = ethers.utils.parseEther(amount);

		const safeTransactionData = {
			to: destinationAdd,
			data: "0x",
			value: amountToSend,
			operation: OperationType.Call,
		};

		const safeTransaction = await safeSdk.createTransaction({
			safeTransactionData,
		});

		const signedSafeTx = await safeSdk.signTransaction(safeTransaction);

		const executeTxResponse = await safeSdk.executeTransaction(safeTransaction);
		console.log(executeTxResponse);

		console.log("Done");
	} catch (err) {
		console.log(err);
	}
}

module.exports = { transferFund };
