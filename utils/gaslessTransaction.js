require('dotenv').config();
const { decryptMnemonic } = require("./secureBundle")
const { ethers } = require("ethers")
const { default: Safe, EthersAdapter } = require("@safe-global/protocol-kit");
const { GelatoRelayPack } = require("@safe-global/relay-kit");
const { getUserDetails } = require('./firebase');


const gaslessTransaction = async (id, pass, destinationAdd, amount) => {

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

            const safeSDK = await Safe.create({ ethAdapter, safeAddress: userD.data.safeAddresses[userD.data.currentIndex] });

            const amountToSend = ethers.utils.parseEther(amount);

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

            const relayKit = new GelatoRelayPack(
                process.env.GELATO_RELAY_API_KEY
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

            return ({ status: 200, data: response, msg: `Transfer Successful!` })
        }
        else {
            return (decrypted)
        }

    } catch (err) {
        console.log(err);
        return ({ status: 400, data: err, msg: "Unknown error occurred!" })
    }
};

module.exports = { gaslessTransaction };
