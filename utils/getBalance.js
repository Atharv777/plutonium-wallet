require('dotenv').config();
const { decryptMnemonic } = require("./secureBundle")
const { ethers } = require("ethers")
const { default: Safe, EthersAdapter } = require("@safe-global/protocol-kit");
const { getUserDetails } = require('./firebase');


async function getBalance(id, pass) {
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
            // Creating protocol kit instance
            const safeSdk = await Safe.create({ ethAdapter, safeAddress: userD.data.safeAddresses[userD.data.currentIndex] });

            const balance = await safeSdk.getBalance();

            const chainId = await safeSdk.getChainId();
            const chains = await fetch("https://chainid.network/chains.json")
            const chainsList = await chains.json()
            const currentChain = chainsList.filter((item) => {
                if (item.chainId === chainId) {
                    return item
                }
            })
            const nativeToken = currentChain[0].nativeCurrency;

            return ({ status: 200, data: `${ethers.utils.formatEther(parseInt(balance._hex).toString())} ${nativeToken.symbol} (${nativeToken.name})`, msg: "Balance fetched successfully!" })

        }
        else {
            return (decrypted)
        }

    } catch (err) {
        console.log(err);
        return ({ status: 400, data: err, msg: "Unknown error occurred!" })
    }
}

module.exports = { getBalance }