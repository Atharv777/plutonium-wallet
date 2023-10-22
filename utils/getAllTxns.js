require('dotenv').config();
const { decryptMnemonic } = require("./secureBundle")
const { ethers } = require("ethers")
const { EthersAdapter } = require("@safe-global/protocol-kit");
const { default: SafeApiKit } = require("@safe-global/api-kit");
const { getUserDetails } = require('./firebase');


async function getAllTxns(id, pass) {
    try {
        const userD = await getUserDetails(id)

        const decrypted = await decryptMnemonic(pass.toString(), JSON.parse(userD.data.encryptedData))

        if (decrypted.status === 200) {
            const wallet = ethers.Wallet.fromMnemonic(decrypted.data.mnemonic, decrypted.data.derivationPath)

            const provider = new ethers.providers.JsonRpcProvider(process.env.GOERLI_RPC);
            const safeOwner = new ethers.Wallet(wallet.privateKey, provider);

            const ethAdapter = new EthersAdapter({
                ethers,
                signerOrProvider: safeOwner,
            });

            const txServiceUrl = "https://safe-transaction-goerli.safe.global";
            const safeService = new SafeApiKit({
                txServiceUrl,
                ethAdapter: ethAdapter,
            });

            const list = await safeService.getAllTransactions(userD.data.safeAddresses[userD.data.currentIndex])

            return ({ status: 200, data: list, msg: "Transactions fetched successfully!" })
        }
        else {
            return (decrypted)
        }


    } catch (err) {
        console.log(err);
        return ({ status: 400, data: err, msg: "Unknown error occurred!" })
    }
}

module.exports = { getAllTxns }