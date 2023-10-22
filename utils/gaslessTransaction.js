import { ethers } from "ethers";
import { EthersAdapter } from "@safe-global/protocol-kit";
import Safe from "@safe-global/protocol-kit";
import { GelatoRelayPack } from "@safe-global/relay-kit";

const gaslessTransaction = async (destinationAdd, amount) => {
	const provider = new ethers.providers.JsonRpcProvider(
		process.env.REACT_APP_INFURA_GOERLI_KEY
	);

	const signer = new ethers.Wallet(wallet.privateKey, provider);

	const amountToSend = ethers.utils.parseEther(amount);

	// Create a transactions array with one transaction object
	const transactions = [
		{
			to: destinationAdd,
			data: "0x",
			value: amountToSend,
		},
	];
	const options = {
		isSponsored: true,
	};
	const ethAdapter = new EthersAdapter({
		ethers,
		signerOrProvider: signer,
	});

	const safeSDK = await Safe.create({
		ethAdapter,
		safeAddress,
	});

	const relayKit = new GelatoRelayPack(
		process.env.REACT_APP_GELATO_RELAY_API_KEY
	);

	const safeTransaction = await relayKit.createRelayedTransaction({
		safe: safeSDK,
		transactions,
		options,
	});

	const signedSafeTransaction = await safeSDK.signTransaction(safeTransaction);
	const response = await relayKit.executeRelayTransaction(
		signedSafeTransaction,
		safeSDK,
		options
	);

	console.log(
		`Relay Transaction Task ID: https://relay.gelato.digital/tasks/status/${response.taskId}`
	);
};

module.exports = { gaslessTransaction };
