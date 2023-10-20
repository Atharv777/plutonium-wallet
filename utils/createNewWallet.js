const { encryptMnemonic, decryptMnemonic } = require("./secureBundle");

const { ethers } = require("ethers");
const { SafeFactory, EthersAdapter } = require("@safe-global/protocol-kit");
import SafeApiKit from "@safe-global/api-kit";

async function createNewWallet(pass) {
	try {
		// Generate new Mnemonic and Keypair
		const wallet = ethers.Wallet.createRandom();

		const address = wallet.address;
		const mnemonic = wallet.mnemonic.phrase;
		const derivationPath = wallet.mnemonic.path;

		// Encrypting the seed phrase and derivatin path
		const encryptedMnemonic = await encryptMnemonic(
			mnemonic,
			derivationPath,
			pass.toString()
		);

		console.log(address, JSON.stringify(encryptedMnemonic));

		return {
			status: 200,
			data: { address, encryptedMnemonic },
			msg: "Successfully created the account!",
		};
	} catch (err) {
		console.log(err);
		return { status: 400, data: err, msg: "Unknown error occurred!" };
	}
}

async function createSafe() {
	try {
		const provider = new ethers.providers.JsonRpcProvider(
			process.env.REACT_APP_INFURA_GOERLI_KEY
		);

		const safeOwner = new ethers.Wallet(wallet.privateKey, provider);
		const gasData = await provider.getFeeData();

		let gasDetails = {
			gasPrice: ethers.BigNumber.from(gasData.gasPrice),
			maxFeePerGas: ethers.BigNumber.from(gasData.maxFeePerGas),
			maxPriorityFeePerGas: ethers.BigNumber.from(gasData.maxPriorityFeePerGas),
		};

		const options = {
			gasPrice: gasDetails.gasPrice._hex,
			gasLimit: 300000,
		};

		const ethAdapter = new EthersAdapter({
			ethers,
			signerOrProvider: safeOwner,
		});

		const txServiceUrl = "https://safe-transaction-goerli.safe.global";
		const safeService = new SafeApiKit({
			txServiceUrl,
			ethAdapter: ethAdapter,
		});

		const safeFactory = await SafeFactory.create({
			ethAdapter: ethAdapter,
		});

		const safeAccountConfig = {
			owners: [await safeOwner.getAddress()],
			threshold: 1,

			// ... (Optional params)
		};

		const transferFund = await transferFundsToNewAccount(
			wallet.address,
			"0.0005"
		);

		const safeSdkOwner1 = await safeFactory.deploySafe({
			safeAccountConfig,
			options: options,
		});

		const tempSafeAddress = await safeSdkOwner1.getAddress();
		console.log("Safe SDK Owner : ", safeSdkOwner1);
		setSafeAddress(tempSafeAddress);
		console.log("Safe Address : ", tempSafeAddress);
		console.log("Your Safe has been deployed:");
		console.log(`https://goerli.etherscan.io/address/${tempSafeAddress}`);
		console.log(`https://app.safe.global/gor:${tempSafeAddress}`);
	} catch (err) {
		console.error(err.message || err);
	}
}

module.exports = { createNewWallet };
module.exports = { createSafe };
