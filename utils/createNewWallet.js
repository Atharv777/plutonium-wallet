
require('dotenv').config();
const { encryptMnemonic } = require("./secureBundle")
const { ethers } = require("ethers")
const { SafeFactory, EthersAdapter } = require("@safe-global/protocol-kit")


async function createNewWallet(pass) {
    try {
        // Generate new Mnemonic and Keypair
        const wallet = ethers.Wallet.createRandom();

        const address = wallet.address;
        const mnemonic = wallet.mnemonic.phrase
        const derivationPath = wallet.mnemonic.path

        // Encrypting the seed phrase and derivatin path
        const encryptedMnemonic = await encryptMnemonic(mnemonic, derivationPath, pass.toString())

        // Deploying Safe
        const safeResp = await deploySafeWrapper(wallet)

        if (safeResp.status === 200) {
            return ({ status: 200, data: { address, encryptedMnemonic, safeAddress: safeResp.data }, msg: "Successfully created the account!" })
        }
        else {
            return (safeResp);
        }
    }
    catch (err) {
        console.log(err);
        return { status: 400, data: err, msg: "Unknown error occurred!" }
    }
}

async function deploySafeWrapper(wallet) {
    try {
        const provider = new ethers.providers.JsonRpcProvider(process.env.GOERLI_RPC);

        const safeOwner = new ethers.Wallet(wallet.privateKey, provider);
        const gasData = await provider.getFeeData();

        const gasDetails = {
            gasPrice: ethers.BigNumber.from(gasData.gasPrice),
            maxFeePerGas: ethers.BigNumber.from(gasData.maxFeePerGas),
            maxPriorityFeePerGas: ethers.BigNumber.from(gasData.maxPriorityFeePerGas)
        };
        const options = {
            gasPrice: gasDetails.gasPrice._hex,
            gasLimit: 300000,
        };

        const ethAdapter = new EthersAdapter({
            ethers,
            signerOrProvider: safeOwner,
        });

        const safeFactory = await SafeFactory.create({
            ethAdapter: ethAdapter,
        });
        const safeAccountConfig = {
            owners: [await safeOwner.getAddress()],
            threshold: 1,
        };

        // Transferring some goerli from Bot owner to safe owner
        try {
            const privateKey = process.env.PRIVATE_KEY;
            const BotOwner = new ethers.Wallet(privateKey, provider);
            // Convert amount to wei
            const amountInWei = ethers.utils.parseEther("0.0005");
            // Create transaction
            const transaction = await BotOwner.sendTransaction({
                to: wallet.address,
                value: amountInWei,
            });
            // Wait for the transaction to be mined
            const receipt = await transaction.wait();
            console.log(receipt.transactionHash);
        }
        catch (error) {
            console.error("Error transferring funds:", error.message);
            return ({ status: 200, data: error, msg: "Error transferring tokens!" })
        }


        // Deploy final Safe contract
        try {
            const safeSdkOwner = await safeFactory.deploySafe({
                safeAccountConfig,
                options: options,
            });
            const safeAddress = await safeSdkOwner.getAddress();
            return ({ status: 200, data: safeAddress, msg: "Successfully created account!" })
        }
        catch (e) {
            console.log(e)
            return ({ status: 400, data: e, msg: "Error while deploying Safe!" })
        }

    } catch (err) {
        console.error(err);
        return ({ status: 400, data: err, msg: "Unknown error occurred!" })
    }
}

module.exports = { createNewWallet }